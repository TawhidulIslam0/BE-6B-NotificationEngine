import type {
  AnalyticsChannel,
  AnalyticsStatus,
  DeliveryCounter,
  FailureCounter,
  LatencyMetric,
} from './types.js';

import type { RedisAnalyticsService } from './redis-analytics-service.js';

const CHANNELS: AnalyticsChannel[] = [
  'email',
  'sms',
  'push',
  'whatsapp',
  'in_app',
];

export class PrometheusMetricsService {
  public constructor(
    private readonly analyticsService: RedisAnalyticsService,
  ) {}

  public async render(): Promise<string> {
    const [deliveryCounters, failureCounters, latencyMetrics] =
      await Promise.all([
        this.analyticsService.getDeliveryCounters(),
        this.analyticsService.getFailureCounters(),
        this.analyticsService.getLatencyMetrics(),
      ]);

    const lines: string[] = [
      '# HELP notification_delivery_total Total notification delivery state changes.',
      '# TYPE notification_delivery_total counter',
      '# HELP notification_delivery_failures_total Total failed notification deliveries.',
      '# TYPE notification_delivery_failures_total counter',
      '# HELP notification_delivery_latency_ms Average notification delivery latency in milliseconds.',
      '# TYPE notification_delivery_latency_ms gauge',
    ];

    for (const channel of CHANNELS) {
      const delivered = this.getDeliveryCount(
        deliveryCounters,
        channel,
        'delivered',
      );

      const failed = this.getDeliveryCount(deliveryCounters, channel, 'failed');

      const failures = this.getFailureCount(failureCounters, channel);

      const latency = this.getLatency(latencyMetrics, channel);

      lines.push(
        `notification_delivery_total{channel="${channel}",status="delivered"} ${delivered}`,
      );

      lines.push(
        `notification_delivery_total{channel="${channel}",status="failed"} ${failed}`,
      );

      lines.push(
        `notification_delivery_failures_total{channel="${channel}"} ${failures}`,
      );

      lines.push(
        `notification_delivery_latency_ms{channel="${channel}"} ${latency}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }

  private getDeliveryCount(
    counters: DeliveryCounter[],
    channel: AnalyticsChannel,
    status: AnalyticsStatus,
  ): number {
    return (
      counters.find(
        (counter) => counter.channel === channel && counter.status === status,
      )?.count ?? 0
    );
  }

  private getFailureCount(
    counters: FailureCounter[],
    channel: AnalyticsChannel,
  ): number {
    return counters.find((counter) => counter.channel === channel)?.count ?? 0;
  }

  private getLatency(
    metrics: LatencyMetric[],
    channel: AnalyticsChannel,
  ): number {
    return metrics.find((metric) => metric.channel === channel)?.averageMs ?? 0;
  }
}
