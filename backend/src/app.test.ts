import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';

describe('createApp', () => {
  it('returns a liveness response', async () => {
    const app = createApp();

    const response = await request(app).get('/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'alive',
      service: 'notification-engine',
    });
    expect(response.body.timestamp).toBeTruthy();
  });

  it('returns healthy when no optional health dependencies are configured', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'healthy',
      service: 'notification-engine',
      checks: {},
    });
  });

  it('runs all configured health checks', async () => {
    const checks = {
      database: vi.fn().mockResolvedValue(true),
      redis: vi.fn().mockResolvedValue(true),
      kafka: vi.fn().mockResolvedValue(true),
      rabbitmq: vi.fn().mockResolvedValue(true),
    };

    const providerHealthService = {
      checkAll: vi.fn().mockResolvedValue({
        healthy: true,
        checkedAt: '2026-01-01T00:00:00.000Z',
        providers: [],
      }),
    };

    const app = createApp({
      readinessChecks: checks,
      providerHealthService: providerHealthService as never,
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks).toEqual({
      database: true,
      redis: true,
      kafka: true,
      rabbitmq: true,
      providers: true,
    });

    expect(checks.database).toHaveBeenCalledOnce();
    expect(checks.redis).toHaveBeenCalledOnce();
    expect(checks.kafka).toHaveBeenCalledOnce();
    expect(checks.rabbitmq).toHaveBeenCalledOnce();
    expect(providerHealthService.checkAll).toHaveBeenCalledOnce();
  });

  it('returns unhealthy when a health dependency fails', async () => {
    const app = createApp({
      readinessChecks: {
        database: vi.fn().mockResolvedValue(false),
        redis: vi.fn().mockResolvedValue(true),
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'unhealthy',
      service: 'notification-engine',
      checks: {
        database: false,
        redis: true,
      },
    });
  });

  it('returns unhealthy when the health check throws', async () => {
    const app = createApp({
      readinessChecks: {
        database: vi.fn().mockRejectedValue(new Error('database unavailable')),
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'unhealthy',
      service: 'notification-engine',
      message: 'Health check failure',
    });
  });

  it('returns ready when configured readiness checks pass', async () => {
    const checks = {
      database: vi.fn().mockResolvedValue(true),
      redis: vi.fn().mockResolvedValue(true),
      kafka: vi.fn().mockResolvedValue(true),
      rabbitmq: vi.fn().mockResolvedValue(true),
    };

    const app = createApp({
      readinessChecks: checks,
    });

    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks).toEqual({
      database: true,
      redis: true,
      kafka: true,
      rabbitmq: true,
    });
  });

  it('returns not-ready when a readiness check fails', async () => {
    const app = createApp({
      readinessChecks: {
        database: vi.fn().mockResolvedValue(true),
        redis: vi.fn().mockResolvedValue(false),
      },
    });

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not-ready',
      service: 'notification-engine',
      checks: {
        database: true,
        redis: false,
      },
    });
  });

  it('returns not-ready when a readiness check throws', async () => {
    const app = createApp({
      readinessChecks: {
        kafka: vi.fn().mockRejectedValue(new Error('Kafka unavailable')),
      },
    });

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not-ready',
      service: 'notification-engine',
    });
  });

  it('returns unavailable when provider health is not configured', async () => {
    const app = createApp();

    const response = await request(app).get('/health/providers');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'unavailable',
      message: 'Provider health service not configured',
    });
  });

  it('returns ok when all providers are healthy', async () => {
    const providerHealthService = {
      checkAll: vi.fn().mockResolvedValue({
        healthy: true,
        checkedAt: '2026-01-01T00:00:00.000Z',
        providers: [
          {
            provider: 'email',
            healthy: true,
            checkedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    };

    const app = createApp({
      providerHealthService: providerHealthService as never,
    });

    const response = await request(app).get('/health/providers');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'notification-engine',
      checkedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(response.body.providers).toHaveLength(1);
  });

  it('returns degraded when provider health reports an unhealthy provider', async () => {
    const providerHealthService = {
      checkAll: vi.fn().mockResolvedValue({
        healthy: false,
        checkedAt: '2026-01-01T00:00:00.000Z',
        providers: [
          {
            provider: 'email',
            healthy: false,
            checkedAt: '2026-01-01T00:00:00.000Z',
            message: 'SMTP unavailable',
          },
        ],
      }),
    };

    const app = createApp({
      providerHealthService: providerHealthService as never,
    });

    const response = await request(app).get('/health/providers');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      service: 'notification-engine',
    });
  });

  it('returns unavailable when the notification producer is not configured', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/events').send({});

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'unavailable',
      message: 'Notification producer is not configured',
    });
  });

  it('accepts a valid event and publishes it', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);

    const app = createApp({
      notificationProducer: {
        publish,
      } as never,
    });

    const event = {
      event_id: 'event-app-test-001',
      event_type: 'user.registered',
      event_version: '1.0',
      occurred_at: '2026-01-01T00:00:00.000Z',
      user_id: 'user-001',
      correlation_id: 'correlation-001',
      source: 'test-suite',
      priority: 'normal',
      payload: {
        name: 'Test User',
        email: 'user@example.com',
      },
    };

    const response = await request(app).post('/api/v1/events').send(event);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      eventId: 'event-app-test-001',
      status: 'accepted',
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(event);
  });

  it('returns a validation error for an invalid event', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);

    const app = createApp({
      notificationProducer: {
        publish,
      } as never,
    });

    const response = await request(app).post('/api/v1/events').send({
      event_id: 'invalid-event',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Invalid notification event',
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('returns analytics delivery rates when analytics is configured', async () => {
    const getDeliveryRates = vi.fn().mockResolvedValue([
      {
        date: '2026-01-01',
        delivered: 100,
      },
    ]);

    const app = createApp({
      analyticsApi: {
        getDeliveryRates,
        getChannelPerformance: vi.fn(),
        getOptOutTrends: vi.fn(),
        getCosts: vi.fn(),
      } as never,
    });

    const response = await request(app)
      .get('/analytics/delivery-rates')
      .query({ days: '7' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        date: '2026-01-01',
        delivered: 100,
      },
    ]);
    expect(getDeliveryRates).toHaveBeenCalledOnce();
  });

  it('returns analytics channel performance', async () => {
    const getChannelPerformance = vi.fn().mockResolvedValue([
      {
        channel: 'email',
        delivered: 90,
      },
    ]);

    const app = createApp({
      analyticsApi: {
        getDeliveryRates: vi.fn(),
        getChannelPerformance,
        getOptOutTrends: vi.fn(),
        getCosts: vi.fn(),
      } as never,
    });

    const response = await request(app)
      .get('/analytics/channel-performance')
      .query({ days: '7' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        channel: 'email',
        delivered: 90,
      },
    ]);
    expect(getChannelPerformance).toHaveBeenCalledOnce();
  });

  it('returns analytics opt-out trends', async () => {
    const getOptOutTrends = vi.fn().mockResolvedValue([
      {
        date: '2026-01-01',
        optOuts: 5,
      },
    ]);

    const app = createApp({
      analyticsApi: {
        getDeliveryRates: vi.fn(),
        getChannelPerformance: vi.fn(),
        getOptOutTrends,
        getCosts: vi.fn(),
      } as never,
    });

    const response = await request(app)
      .get('/analytics/opt-out-trends')
      .query({ days: '7' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        date: '2026-01-01',
        optOuts: 5,
      },
    ]);
    expect(getOptOutTrends).toHaveBeenCalledOnce();
  });

  it('returns analytics costs', async () => {
    const getCosts = vi.fn().mockResolvedValue({
      totalCost: 12.5,
    });

    const app = createApp({
      analyticsApi: {
        getDeliveryRates: vi.fn(),
        getChannelPerformance: vi.fn(),
        getOptOutTrends: vi.fn(),
        getCosts,
      } as never,
    });

    const response = await request(app)
      .get('/analytics/costs')
      .query({ days: '7' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalCost: 12.5,
    });
    expect(getCosts).toHaveBeenCalledOnce();
  });

  it('returns Prometheus metrics when the metrics service is configured', async () => {
    const render = vi
      .fn()
      .mockResolvedValue(
        '# HELP notification_total Total notifications\nnotification_total 5\n',
      );

    const app = createApp({
      prometheusMetricsService: {
        render,
      } as never,
    });

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.text).toContain('notification_total 5');
    expect(render).toHaveBeenCalledOnce();
  });

  it('uses the global error handler for asynchronous route failures', async () => {
    const getDeliveryRates = vi
      .fn()
      .mockRejectedValue(new Error('analytics unavailable'));

    const app = createApp({
      analyticsApi: {
        getDeliveryRates,
        getChannelPerformance: vi.fn(),
        getOptOutTrends: vi.fn(),
        getCosts: vi.fn(),
      } as never,
    });

    const response = await request(app).get('/analytics/delivery-rates');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Internal server error',
    });
  });
});
