import type { Knex } from 'knex';

import type {
  AnalyticsChannel,
  AnalyticsQueryOptions,
  ChannelCostMetric,
  ChannelPerformance,
  DeliveryRateMetric,
  EventTypeCostMetric,
  OptOutTrend,
  UserCostMetric,
} from './types.js';

interface DeliveryRateRow {
  total: string;
  delivered: string;
  failed: string;
}

interface ChannelPerformanceRow {
  channel: string;
  total: string;
  delivered: string;
  failed: string;
  average_latency_ms: string | null;
}

interface OptOutTrendRow {
  period: string;
  channel: string;
  opt_outs: string;
}

interface TotalCostRow {
  total_cost: string | null;
  currency: string | null;
}

interface ChannelCostRow {
  channel: string;
  total_cost: string;
  currency: string;
}

interface EventTypeCostRow {
  event_type: string;
  total_cost: string;
  currency: string;
}

interface UserCostRow {
  user_id: string;
  total_cost: string;
  currency: string;
}

const CHANNELS: AnalyticsChannel[] = [
  'email',
  'sms',
  'push',
  'whatsapp',
  'in_app',
];

/** Reads delivery, opt-out, and cost aggregates from PostgreSQL. */
export class PostgresAnalyticsRepository {
  private readonly db: Knex;

  public constructor(db: Knex) {
    this.db = db;
  }

  public async getDeliveryRates(
    options: AnalyticsQueryOptions = {},
  ): Promise<DeliveryRateMetric> {
    const query = this.db
      .from('notification_state_log as state_log')
      .join('notifications as notification', function joinNotifications() {
        this.on('notification.id', '=', 'state_log.notification_id').andOn(
          'notification.created_at',
          '=',
          'state_log.notification_created_at',
        );
      })
      .whereIn('state_log.to_state', ['delivered', 'failed']);

    this.applyDateFilter(query, options);

    if (options.eventType) {
      query.where('notification.event_type', options.eventType);
    }

    if (options.userId) {
      query.where('notification.user_id', options.userId);
    }

    if (options.priority) {
      query.where('notification.priority', options.priority);
    }

    const row = await query
      .select(
        this.db.raw('COUNT(*)::text AS total'),
        this.db.raw(`
          COUNT(*) FILTER (
            WHERE state_log.to_state = 'delivered'
          )::text AS delivered
        `),
        this.db.raw(`
          COUNT(*) FILTER (
            WHERE state_log.to_state = 'failed'
          )::text AS failed
        `),
      )
      .first<DeliveryRateRow>();

    const total = Number(row?.total ?? 0);
    const delivered = Number(row?.delivered ?? 0);
    const failed = Number(row?.failed ?? 0);

    return {
      total,
      delivered,
      failed,
      deliveryRate: total === 0 ? 0 : delivered / total,
      failureRate: total === 0 ? 0 : failed / total,
    };
  }

  public async getChannelPerformance(
    options: AnalyticsQueryOptions = {},
  ): Promise<ChannelPerformance[]> {
    const query = this.db
      .from('notification_state_log as state_log')
      .join('notifications as notification', function joinNotifications() {
        this.on('notification.id', '=', 'state_log.notification_id').andOn(
          'notification.created_at',
          '=',
          'state_log.notification_created_at',
        );
      })
      .whereIn('state_log.to_state', ['delivered', 'failed']);

    this.applyDateFilter(query, options);

    if (options.eventType) {
      query.where('notification.event_type', options.eventType);
    }

    if (options.userId) {
      query.where('notification.user_id', options.userId);
    }

    if (options.priority) {
      query.where('notification.priority', options.priority);
    }

    const rows = (await query
      .select(
        this.db.raw(`
          COALESCE(
            state_log.metadata->>'channel',
            'unknown'
          ) AS channel
        `),
        this.db.raw('COUNT(*)::text AS total'),
        this.db.raw(`
          COUNT(*) FILTER (
            WHERE state_log.to_state = 'delivered'
          )::text AS delivered
        `),
        this.db.raw(`
          COUNT(*) FILTER (
            WHERE state_log.to_state = 'failed'
          )::text AS failed
        `),
        this.db.raw(`
          AVG(
            CASE
              WHEN jsonb_typeof(state_log.metadata->'latencyMs') = 'number'
              THEN (state_log.metadata->>'latencyMs')::numeric
              ELSE NULL
            END
          )::text AS average_latency_ms
        `),
      )
      .groupByRaw(
        `
        COALESCE(
          state_log.metadata->>'channel',
          'unknown'
        )
      `,
      )
      .orderBy('channel', 'asc')) as ChannelPerformanceRow[];

    return rows.map((row) => {
      const total = Number(row.total);
      const delivered = Number(row.delivered);
      const failed = Number(row.failed);

      return {
        channel: this.normalizeChannel(row.channel),
        total,
        delivered,
        failed,
        deliveryRate: total === 0 ? 0 : delivered / total,
        averageLatencyMs: Number(row.average_latency_ms ?? 0),
      };
    });
  }

  public async getOptOutTrends(
    options: AnalyticsQueryOptions = {},
  ): Promise<OptOutTrend[]> {
    const query = this.db.from('consent_records').where('granted', false);

    if (options.startDate) {
      query.where('recorded_at', '>=', options.startDate);
    }

    if (options.endDate) {
      query.where('recorded_at', '<', options.endDate);
    }

    if (options.channel) {
      query.where('channel', options.channel);
    }

    const rows = (await query
      .select(
        this.db.raw(`
          TO_CHAR(
            DATE_TRUNC(
              'day',
              recorded_at
            ),
            'YYYY-MM-DD'
          ) AS period
        `),
        'channel',
      )
      .count('* as opt_outs')
      .groupByRaw(
        `
        DATE_TRUNC(
          'day',
          recorded_at
        ),
        channel
      `,
      )
      .orderBy('period', 'asc')
      .orderBy('channel', 'asc')) as OptOutTrendRow[];

    return rows.map((row) => ({
      period: row.period,
      channel: this.normalizeChannel(row.channel),
      optOuts: Number(row.opt_outs ?? 0),
    }));
  }

  public async getTotalCost(options: AnalyticsQueryOptions = {}): Promise<{
    totalCost: number;
    currency: string;
  }> {
    const query = this.createCostQuery(options);

    const row = await query
      .select(
        this.db.raw(`
          COALESCE(
            SUM(
              CASE
                WHEN jsonb_typeof(state_log.metadata->'cost') = 'number'
                THEN (state_log.metadata->>'cost')::numeric
                ELSE 0
              END
            ),
            0
          )::text AS total_cost
        `),
        this.db.raw(`
          COALESCE(
            MAX(state_log.metadata->>'currency'),
            'USD'
          ) AS currency
        `),
      )
      .first<TotalCostRow>();

    return {
      totalCost: Number(row?.total_cost ?? 0),
      currency: row?.currency ?? 'USD',
    };
  }

  public async getCostByChannel(
    options: AnalyticsQueryOptions = {},
  ): Promise<ChannelCostMetric[]> {
    const query = this.createCostQuery(options);

    const rows = (await query
      .select(
        this.db.raw(`
          COALESCE(
            state_log.metadata->>'channel',
            'unknown'
          ) AS channel
        `),
        this.db.raw(`
          COALESCE(
            SUM(
              CASE
                WHEN jsonb_typeof(state_log.metadata->'cost') = 'number'
                THEN (state_log.metadata->>'cost')::numeric
                ELSE 0
              END
            ),
            0
          )::text AS total_cost
        `),
        this.db.raw(`
          COALESCE(
            MAX(state_log.metadata->>'currency'),
            'USD'
          ) AS currency
        `),
      )
      .groupByRaw(
        `
        COALESCE(
          state_log.metadata->>'channel',
          'unknown'
        )
      `,
      )
      .orderBy('channel', 'asc')) as ChannelCostRow[];

    return rows
      .filter((row) => CHANNELS.includes(row.channel as AnalyticsChannel))
      .map((row) => ({
        channel: row.channel as AnalyticsChannel,
        totalCost: Number(row.total_cost),
        currency: row.currency,
      }));
  }

  public async getCostByEventType(
    options: AnalyticsQueryOptions = {},
  ): Promise<EventTypeCostMetric[]> {
    const query = this.createCostQuery(options);

    const rows = (await query
      .select(
        'notification.event_type',
        this.db.raw(`
          COALESCE(
            SUM(
              CASE
                WHEN jsonb_typeof(state_log.metadata->'cost') = 'number'
                THEN (state_log.metadata->>'cost')::numeric
                ELSE 0
              END
            ),
            0
          )::text AS total_cost
        `),
        this.db.raw(`
          COALESCE(
            MAX(state_log.metadata->>'currency'),
            'USD'
          ) AS currency
        `),
      )
      .groupBy('notification.event_type')
      .orderBy('notification.event_type', 'asc')) as EventTypeCostRow[];

    return rows.map((row) => ({
      eventType: row.event_type,
      totalCost: Number(row.total_cost),
      currency: row.currency,
    }));
  }

  public async getCostByUser(
    options: AnalyticsQueryOptions = {},
  ): Promise<UserCostMetric[]> {
    const query = this.createCostQuery(options);

    const rows = (await query
      .select(
        'notification.user_id',
        this.db.raw(`
          COALESCE(
            SUM(
              CASE
                WHEN jsonb_typeof(state_log.metadata->'cost') = 'number'
                THEN (state_log.metadata->>'cost')::numeric
                ELSE 0
              END
            ),
            0
          )::text AS total_cost
        `),
        this.db.raw(`
          COALESCE(
            MAX(state_log.metadata->>'currency'),
            'USD'
          ) AS currency
        `),
      )
      .groupBy('notification.user_id')
      .orderBy('notification.user_id', 'asc')) as UserCostRow[];

    return rows.map((row) => ({
      userId: row.user_id,
      totalCost: Number(row.total_cost),
      currency: row.currency,
    }));
  }

  private createCostQuery(options: AnalyticsQueryOptions): Knex.QueryBuilder {
    const query = this.db
      .from('notification_state_log as state_log')
      .join('notifications as notification', function joinNotifications() {
        this.on('notification.id', '=', 'state_log.notification_id').andOn(
          'notification.created_at',
          '=',
          'state_log.notification_created_at',
        );
      })
      .whereIn('state_log.to_state', ['delivered', 'failed']);

    this.applyDateFilter(query, options);

    if (options.eventType) {
      query.where('notification.event_type', options.eventType);
    }

    if (options.userId) {
      query.where('notification.user_id', options.userId);
    }

    if (options.priority) {
      query.where('notification.priority', options.priority);
    }

    return query;
  }

  private applyDateFilter(
    query: Knex.QueryBuilder,
    options: AnalyticsQueryOptions,
  ): void {
    if (options.startDate) {
      query.where('state_log.created_at', '>=', options.startDate);
    }

    if (options.endDate) {
      query.where('state_log.created_at', '<', options.endDate);
    }

    if (options.channel) {
      query.whereRaw(`state_log.metadata->>'channel' = ?`, [options.channel]);
    }
  }

  private normalizeChannel(channel: string): AnalyticsChannel {
    if (CHANNELS.includes(channel as AnalyticsChannel)) {
      return channel as AnalyticsChannel;
    }

    return 'in_app';
  }
}
