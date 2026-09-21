import express from 'express';

import {
  createPreferenceHandlers,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
  PreferenceService,
} from './preferences/index.js';

import type { ProviderHealthService } from './delivery/health/provider-health-service.js';

import type { DlqDashboardService } from './delivery/dlq/dlq-dashboard-service.js';

import { createDlqDashboardRouter } from './delivery/dlq/dlq-dashboard-api.js';

import type { AnalyticsApi } from './analytics/analytics-api.js';

import type { PrometheusMetricsService } from './analytics/prometheus-metrics-service.js';

import type { NotificationProducer } from './events/producer/notification-producer.js';

import { validateEvent } from './events/factory/event-factory.js';

export interface AppDependencies {
  providerHealthService?: ProviderHealthService;
  dlqDashboardService?: DlqDashboardService;
  analyticsApi?: AnalyticsApi;
  prometheusMetricsService?: PrometheusMetricsService;
  notificationProducer?: NotificationProducer;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'notification-engine',
    });
  });

  app.get('/health/providers', async (_request, response) => {
    if (dependencies.providerHealthService === undefined) {
      response.status(503).json({
        status: 'unavailable',
        service: 'notification-engine',
        message: 'Provider health service is not configured',
      });

      return;
    }

    const health = await dependencies.providerHealthService.checkAll();

    response.status(health.healthy ? 200 : 503).json({
      status: health.healthy ? 'ok' : 'degraded',
      service: 'notification-engine',
      checkedAt: health.checkedAt,
      providers: health.providers,
    });
  });

  app.post('/api/v1/events', async (request, response) => {
    if (dependencies.notificationProducer === undefined) {
      response.status(503).json({
        status: 'unavailable',
        message: 'Notification producer is not configured',
      });

      return;
    }

    let event;

    try {
      event = validateEvent(request.body);
    } catch (error) {
      console.error('Event validation error:', error);

      response.status(400).json({
        status: 'error',
        message: 'Invalid notification event',
      });

      return;
    }

    try {
      await dependencies.notificationProducer.publish(event);
    } catch (error) {
      console.error('Event publishing error:', error);

      response.status(503).json({
        status: 'error',
        message: 'Failed to publish notification event',
      });

      return;
    }

    response.status(202).json({
      eventId: event.event_id,
      status: 'accepted',
    });
  });

  const preferenceService = new PreferenceService(
    new InMemoryPreferenceStore(),
    new InMemoryPreferenceCache(),
  );

  const handlers = createPreferenceHandlers(preferenceService);

  app.get('/users/:id/preferences', handlers.get);

  app.put('/users/:id/preferences', handlers.put);

  if (dependencies.dlqDashboardService !== undefined) {
    app.use(createDlqDashboardRouter(dependencies.dlqDashboardService));
  }

  if (dependencies.analyticsApi !== undefined) {
    app.get('/analytics/delivery-rates', async (request, response) => {
      try {
        const result = await dependencies.analyticsApi!.getDeliveryRates(
          request.query,
        );

        response.status(200).json(result);
      } catch (error) {
        console.error('Analytics delivery-rates error:', error);

        response.status(500).json({
          status: 'error',
          message: 'Failed to retrieve delivery-rate analytics',
        });
      }
    });

    app.get('/analytics/channel-performance', async (request, response) => {
      try {
        const result = await dependencies.analyticsApi!.getChannelPerformance(
          request.query,
        );

        response.status(200).json(result);
      } catch (error) {
        console.error('Analytics channel-performance error:', error);

        response.status(500).json({
          status: 'error',
          message: 'Failed to retrieve channel-performance analytics',
        });
      }
    });

    app.get('/analytics/opt-out-trends', async (request, response) => {
      try {
        const result = await dependencies.analyticsApi!.getOptOutTrends(
          request.query,
        );

        response.status(200).json(result);
      } catch (error) {
        console.error('Analytics opt-out-trends error:', error);

        response.status(500).json({
          status: 'error',
          message: 'Failed to retrieve opt-out analytics',
        });
      }
    });

    app.get('/analytics/costs', async (request, response) => {
      try {
        const result = await dependencies.analyticsApi!.getCosts(request.query);

        response.status(200).json(result);
      } catch (error) {
        console.error('Analytics costs error:', error);

        response.status(500).json({
          status: 'error',
          message: 'Failed to retrieve cost analytics',
        });
      }
    });
  }

  if (dependencies.prometheusMetricsService !== undefined) {
    app.get('/metrics', async (_request, response) => {
      try {
        const metrics = await dependencies.prometheusMetricsService!.render();

        response.status(200).type('text/plain').send(metrics);
      } catch (error) {
        console.error('Prometheus metrics error:', error);

        response
          .status(500)
          .type('text/plain')
          .send('# Metrics collection failed\n');
      }
    });
  }

  return app;
}
