import type {
  AnalyticsQueryOptions,
  ChannelPerformance,
  CostAnalytics,
  DeliveryRateMetric,
  OptOutTrend,
} from './types.js';

import { PostgresAnalyticsRepository } from './postgres-analytics-repository.js';

/** Application-facing facade for analytics queries. */
export class AnalyticsApi {
  public constructor(
    private readonly repository: PostgresAnalyticsRepository,
  ) {}

  /** Returns delivery and failure rates for the requested filters. */
  public async getDeliveryRates(
    query: Record<string, unknown>,
  ): Promise<DeliveryRateMetric> {
    const options = this.parseQueryOptions(query);

    return this.repository.getDeliveryRates(options);
  }

  /** Returns delivery volume and latency grouped by channel. */
  public async getChannelPerformance(
    query: Record<string, unknown>,
  ): Promise<ChannelPerformance[]> {
    const options = this.parseQueryOptions(query);

    return this.repository.getChannelPerformance(options);
  }

  /** Returns opt-out counts grouped by period and channel. */
  public async getOptOutTrends(
    query: Record<string, unknown>,
  ): Promise<OptOutTrend[]> {
    const options = this.parseQueryOptions(query);

    return this.repository.getOptOutTrends(options);
  }

  /** Returns total and dimensional delivery-cost aggregates. */
  public async getCosts(
    query: Record<string, unknown>,
  ): Promise<CostAnalytics> {
    const options = this.parseQueryOptions(query);

    const [total, byChannel, byEventType, byUser] = await Promise.all([
      this.repository.getTotalCost(options),
      this.repository.getCostByChannel(options),
      this.repository.getCostByEventType(options),
      this.repository.getCostByUser(options),
    ]);

    return {
      total,
      byChannel,
      byEventType,
      byUser,
    };
  }

  private parseQueryOptions(
    query: Record<string, unknown>,
  ): AnalyticsQueryOptions {
    const options: AnalyticsQueryOptions = {};

    const startDate = this.getString(query.startDate);
    const endDate = this.getString(query.endDate);
    const channel = this.getString(query.channel);
    const eventType = this.getString(query.eventType);
    const userId = this.getString(query.userId);
    const priority = this.getString(query.priority);

    if (startDate) {
      const parsed = new Date(startDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid startDate');
      }

      options.startDate = parsed;
    }

    if (endDate) {
      const parsed = new Date(endDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid endDate');
      }

      options.endDate = parsed;
    }

    if (channel) {
      options.channel = channel as AnalyticsQueryOptions['channel'];
    }

    if (eventType) {
      options.eventType = eventType;
    }

    if (userId) {
      options.userId = userId;
    }

    if (priority) {
      options.priority = priority as AnalyticsQueryOptions['priority'];
    }

    return options;
  }

  private getString(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }

    return value;
  }
}
