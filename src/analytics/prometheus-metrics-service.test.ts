import { describe, expect, it, vi } from 'vitest';

import type {
  DeliveryCounter,
  FailureCounter,
  LatencyMetric,
} from './types.js';

import { PrometheusMetricsService } from './prometheus-metrics-service.js';

import type { RedisAnalyticsService } from './redis-analytics-service.js';

describe('PrometheusMetricsService', () => {
  const createService = (
    deliveryCounters: DeliveryCounter[] = [],
    failureCounters: FailureCounter[] = [],
    latencyMetrics: LatencyMetric[] = [],
  ): PrometheusMetricsService => {
    const analyticsService = {
      getDeliveryCounters: vi.fn().mockResolvedValue(deliveryCounters),

      getFailureCounters: vi.fn().mockResolvedValue(failureCounters),

      getLatencyMetrics: vi.fn().mockResolvedValue(latencyMetrics),
    } as unknown as RedisAnalyticsService;

    return new PrometheusMetricsService(analyticsService);
  };

  it('renders Prometheus HELP and TYPE metadata', async () => {
    const service = createService();

    const output = await service.render();

    expect(output).toContain(
      '# HELP notification_delivery_total Total notification delivery state changes.',
    );

    expect(output).toContain('# TYPE notification_delivery_total counter');

    expect(output).toContain(
      '# HELP notification_delivery_failures_total Total failed notification deliveries.',
    );

    expect(output).toContain(
      '# TYPE notification_delivery_failures_total counter',
    );

    expect(output).toContain(
      '# HELP notification_delivery_latency_ms Average notification delivery latency in milliseconds.',
    );

    expect(output).toContain('# TYPE notification_delivery_latency_ms gauge');
  });

  it('renders delivered and failed delivery counters', async () => {
    const service = createService([
      {
        channel: 'email',
        status: 'delivered',
        count: 125,
      },
      {
        channel: 'email',
        status: 'failed',
        count: 7,
      },
    ]);

    const output = await service.render();

    expect(output).toContain(
      'notification_delivery_total{channel="email",status="delivered"} 125',
    );

    expect(output).toContain(
      'notification_delivery_total{channel="email",status="failed"} 7',
    );
  });

  it('renders dedicated failure counters', async () => {
    const service = createService(
      [],
      [
        {
          channel: 'sms',
          count: 11,
        },
      ],
    );

    const output = await service.render();

    expect(output).toContain(
      'notification_delivery_failures_total{channel="sms"} 11',
    );
  });

  it('renders average latency for each channel', async () => {
    const service = createService(
      [],
      [],
      [
        {
          channel: 'push',
          count: 20,
          totalMs: 5000,
          averageMs: 250,
          minMs: 100,
          maxMs: 600,
        },
      ],
    );

    const output = await service.render();

    expect(output).toContain(
      'notification_delivery_latency_ms{channel="push"} 250',
    );
  });

  it('renders zero values when analytics data is empty', async () => {
    const service = createService();

    const output = await service.render();

    expect(output).toContain(
      'notification_delivery_total{channel="email",status="delivered"} 0',
    );

    expect(output).toContain(
      'notification_delivery_total{channel="sms",status="failed"} 0',
    );

    expect(output).toContain(
      'notification_delivery_failures_total{channel="whatsapp"} 0',
    );

    expect(output).toContain(
      'notification_delivery_latency_ms{channel="in_app"} 0',
    );
  });

  it('renders metrics for all supported channels', async () => {
    const service = createService();

    const output = await service.render();

    expect(output).toContain('channel="email"');

    expect(output).toContain('channel="sms"');

    expect(output).toContain('channel="push"');

    expect(output).toContain('channel="whatsapp"');

    expect(output).toContain('channel="in_app"');
  });

  it('returns output ending with a newline', async () => {
    const service = createService();

    const output = await service.render();

    expect(output.endsWith('\n')).toBe(true);
  });
});
