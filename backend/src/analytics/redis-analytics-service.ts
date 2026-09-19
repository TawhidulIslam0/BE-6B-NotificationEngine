import type Redis from 'ioredis';

import type {
  AnalyticsChannel,
  AnalyticsStatus,
  ChannelPerformance,
  DeliveryCounter,
  FailureCounter,
  LatencyMetric,
} from './types.js';

export interface AnalyticsRecord {
  channel: AnalyticsChannel;
  status: AnalyticsStatus;
  latencyMs?: number;
  timestamp?: Date;
}

export interface RedisAnalyticsConfig {
  keyPrefix: string;
  windowTtlSeconds: number;
}

const DEFAULT_CONFIG: RedisAnalyticsConfig = {
  keyPrefix: 'notification:analytics',
  windowTtlSeconds: 8 * 24 * 60 * 60,
};

export class RedisAnalyticsService {
  private readonly redis: Redis;
  private readonly config: RedisAnalyticsConfig;

  public constructor(redis: Redis, config: Partial<RedisAnalyticsConfig> = {}) {
    this.redis = redis;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  public getConfig(): RedisAnalyticsConfig {
    return {
      ...this.config,
    };
  }

  public async record(record: AnalyticsRecord): Promise<void> {
    const timestamp = record.timestamp ?? new Date();

    const timestampMs = timestamp.getTime();

    const channel = record.channel;

    const status = record.status;

    const totalKey = this.getCounterKey('deliveries', channel);

    const statusKey = this.getCounterKey('status', channel, status);

    const operations: Promise<unknown>[] = [
      this.redis.incr(totalKey),
      this.redis.incr(statusKey),
      this.redis.expire(totalKey, this.config.windowTtlSeconds),
      this.redis.expire(statusKey, this.config.windowTtlSeconds),
    ];

    if (status === 'failed') {
      const failureKey = this.getCounterKey('failures', channel);

      operations.push(
        this.redis.incr(failureKey),
        this.redis.expire(failureKey, this.config.windowTtlSeconds),
      );
    }

    if (record.latencyMs !== undefined) {
      this.validateLatency(record.latencyMs);

      const latencyKey = this.getLatencyKey(channel);

      operations.push(
        this.redis.incr(`${latencyKey}:count`),
        this.redis.incrby(`${latencyKey}:sum`, Math.round(record.latencyMs)),
        this.redis.expire(`${latencyKey}:count`, this.config.windowTtlSeconds),
        this.redis.expire(`${latencyKey}:sum`, this.config.windowTtlSeconds),
      );

      const sampleKey = `${latencyKey}:samples`;

      operations.push(
        this.redis.zadd(
          sampleKey,
          timestampMs,
          `${timestampMs}:${record.latencyMs}`,
        ),
        this.redis.expire(sampleKey, this.config.windowTtlSeconds),
      );
    }

    for (const window of ['hourly', 'daily', 'weekly'] as const) {
      const bucket = this.getWindowBucket(window, timestamp);

      const windowKey = `${this.config.keyPrefix}:${window}:${bucket}`;

      operations.push(
        this.redis.hincrby(windowKey, `total:${channel}`, 1),
        this.redis.hincrby(windowKey, `${status}:${channel}`, 1),
        this.redis.expire(windowKey, this.config.windowTtlSeconds),
      );

      if (record.latencyMs !== undefined) {
        operations.push(
          this.redis.hincrby(windowKey, `latency_count:${channel}`, 1),
          this.redis.hincrby(
            windowKey,
            `latency_sum:${channel}`,
            Math.round(record.latencyMs),
          ),
        );
      }
    }

    await Promise.all(operations);
  }

  public async getDeliveryCounters(): Promise<DeliveryCounter[]> {
    const channels = this.getChannels();

    const statuses = this.getStatuses();

    const counters: DeliveryCounter[] = [];

    for (const channel of channels) {
      for (const status of statuses) {
        const key = this.getCounterKey('status', channel, status);

        const value = await this.redis.get(key);

        counters.push({
          channel,
          status,
          count: Number(value ?? 0),
        });
      }
    }

    return counters;
  }

  public async getFailureCounters(): Promise<FailureCounter[]> {
    const counters: FailureCounter[] = [];

    for (const channel of this.getChannels()) {
      const key = this.getCounterKey('failures', channel);

      const value = await this.redis.get(key);

      counters.push({
        channel,
        count: Number(value ?? 0),
      });
    }

    return counters;
  }

  public async getLatencyMetrics(): Promise<LatencyMetric[]> {
    const metrics: LatencyMetric[] = [];

    for (const channel of this.getChannels()) {
      const latencyKey = this.getLatencyKey(channel);

      const [countValue, sumValue, samples] = await Promise.all([
        this.redis.get(`${latencyKey}:count`),
        this.redis.get(`${latencyKey}:sum`),
        this.redis.zrange(`${latencyKey}:samples`, '0', '-1'),
      ]);

      const count = Number(countValue ?? 0);

      const totalMs = Number(sumValue ?? 0);

      const latencies = samples.map((sample) => {
        const separator = sample.lastIndexOf(':');

        return Number(sample.slice(separator + 1));
      });

      metrics.push({
        channel,
        count,
        totalMs,
        averageMs: count === 0 ? 0 : totalMs / count,
        minMs: latencies.length === 0 ? 0 : Math.min(...latencies),
        maxMs: latencies.length === 0 ? 0 : Math.max(...latencies),
      });
    }

    return metrics;
  }

  public async getChannelPerformance(): Promise<ChannelPerformance[]> {
    const [counters, latencyMetrics] = await Promise.all([
      this.getDeliveryCounters(),
      this.getLatencyMetrics(),
    ]);

    return this.getChannels().map((channel) => {
      const channelCounters = counters.filter(
        (counter) => counter.channel === channel,
      );

      const total = channelCounters.reduce(
        (sum, counter) => sum + counter.count,
        0,
      );

      const delivered =
        channelCounters.find((counter) => counter.status === 'delivered')
          ?.count ?? 0;

      const failed =
        channelCounters.find((counter) => counter.status === 'failed')?.count ??
        0;

      const latency = latencyMetrics.find(
        (metric) => metric.channel === channel,
      );

      return {
        channel,
        total,
        delivered,
        failed,
        deliveryRate: total === 0 ? 0 : delivered / total,
        averageLatencyMs: latency?.averageMs ?? 0,
      };
    });
  }

  public async getWindow(
    window: 'hourly' | 'daily' | 'weekly',
    timestamp: Date = new Date(),
  ): Promise<Record<string, string>> {
    const bucket = this.getWindowBucket(window, timestamp);

    const key = `${this.config.keyPrefix}:${window}:${bucket}`;

    return this.redis.hgetall(key);
  }

  private getCounterKey(
    category: string,
    channel: AnalyticsChannel,
    status?: AnalyticsStatus,
  ): string {
    const parts = [this.config.keyPrefix, category, channel];

    if (status) {
      parts.push(status);
    }

    return parts.join(':');
  }

  private getLatencyKey(channel: AnalyticsChannel): string {
    return `${this.config.keyPrefix}:latency:${channel}`;
  }

  private getWindowBucket(
    window: 'hourly' | 'daily' | 'weekly',
    timestamp: Date,
  ): string {
    const year = timestamp.getUTCFullYear();

    const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');

    const day = String(timestamp.getUTCDate()).padStart(2, '0');

    if (window === 'hourly') {
      const hour = String(timestamp.getUTCHours()).padStart(2, '0');

      return `${year}-${month}-${day}-${hour}`;
    }

    if (window === 'daily') {
      return `${year}-${month}-${day}`;
    }

    const dayOfWeek = timestamp.getUTCDay();

    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(timestamp.getTime());

    monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);

    return [
      monday.getUTCFullYear(),
      String(monday.getUTCMonth() + 1).padStart(2, '0'),
      String(monday.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  private validateLatency(latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      throw new Error('Latency must be a non-negative finite number');
    }
  }

  private getChannels(): AnalyticsChannel[] {
    return ['email', 'sms', 'push', 'whatsapp', 'in_app'];
  }

  private getStatuses(): AnalyticsStatus[] {
    return ['accepted', 'queued', 'sent', 'delivered', 'failed', 'unknown'];
  }
}
