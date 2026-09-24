import fs from 'node:fs';
import path from 'node:path';

import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

import {
  createPreferenceHandlers,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
  PreferenceService,
} from './preferences/index.js';

import type { ProviderHealthService } from './delivery/health/provider-health-service.js';
import type { DlqDashboardService } from './delivery/dlq/dlq-dashboard-service.js';
import type { AnalyticsApi } from './analytics/analytics-api.js';
import type { PrometheusMetricsService } from './analytics/prometheus-metrics-service.js';
import type { NotificationProducer } from './events/producer/notification-producer.js';
import { createDlqDashboardRouter } from './delivery/dlq/dlq-dashboard-api.js';
import { validateEvent } from './events/factory/event-factory.js';
import { createCorrelationLogger } from './logging/correlation.js';
import { logger } from './logging/logger.js';

const openApiPath = path.resolve(__dirname, '../docs/openapi.yaml');
const openApiDocument = parse(fs.readFileSync(openApiPath, 'utf8'));

export interface AppDependencies {
  providerHealthService?: ProviderHealthService;
  dlqDashboardService?: DlqDashboardService;
  analyticsApi?: AnalyticsApi;
  prometheusMetricsService?: PrometheusMetricsService;
  notificationProducer?: NotificationProducer;

  readinessChecks?: {
    database?: () => Promise<boolean>;
    redis?: () => Promise<boolean>;
    kafka?: () => Promise<boolean>;
    rabbitmq?: () => Promise<boolean>;
  };
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(express.json());

  /**
   * Public API rate limiting.
   *
   * Health probes, Swagger UI, and Prometheus metrics are intentionally
   * excluded because infrastructure monitoring should not consume API
   * request quota.
   */
  const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many requests. Please try again later.',
    },
    skip: (request) =>
      request.path === '/live' ||
      request.path === '/health' ||
      request.path === '/ready' ||
      request.path === '/health/providers' ||
      request.path === '/metrics' ||
      request.path.startsWith('/api-docs'),
  });

  app.use(publicApiLimiter);

  /**
   * Stricter event-ingestion rate limit.
   *
   * Event publishing is the highest-volume public endpoint, so it receives
   * its own per-IP limit in addition to the global public API limit.
   */
  const eventIngestionLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Event ingestion rate limit exceeded. Please try again later.',
    },
  });

  app.use('/api/v1/events', eventIngestionLimiter);

  /**
   * Swagger UI
   */
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  /**
   * Request logging middleware
   */
  app.use((request, response, next) => {
    const startedAt = Date.now();

    response.on('finish', () => {
      logger.info(
        {
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          remoteAddress: request.ip,
        },
        'HTTP request completed',
      );
    });

    next();
  });

  /**
   * Liveness probe
   * Process is alive.
   */
  app.get('/live', (_request, response) => {
    response.status(200).json({
      status: 'alive',
      service: 'notification-engine',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Comprehensive health check
   */
  app.get('/health', async (_request, response) => {
    const checks: Record<string, boolean> = {};

    try {
      if (dependencies.readinessChecks?.database) {
        checks.database = await dependencies.readinessChecks.database();
      }

      if (dependencies.readinessChecks?.redis) {
        checks.redis = await dependencies.readinessChecks.redis();
      }

      if (dependencies.readinessChecks?.kafka) {
        checks.kafka = await dependencies.readinessChecks.kafka();
      }

      if (dependencies.readinessChecks?.rabbitmq) {
        checks.rabbitmq = await dependencies.readinessChecks.rabbitmq();
      }

      if (dependencies.providerHealthService) {
        const providers = await dependencies.providerHealthService.checkAll();

        checks.providers = providers.healthy;
      }

      const healthy = Object.values(checks).every(Boolean);

      response.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        service: 'notification-engine',
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          error,
        },
        'Health check failed',
      );

      response.status(503).json({
        status: 'unhealthy',
        service: 'notification-engine',
        message: 'Health check failure',
      });
    }
  });

  /**
   * Readiness probe
   * Dependencies required before accepting traffic.
   */
  app.get('/ready', async (_request, response) => {
    const checks: Record<string, boolean> = {};

    try {
      if (dependencies.readinessChecks?.database) {
        checks.database = await dependencies.readinessChecks.database();
      }

      if (dependencies.readinessChecks?.redis) {
        checks.redis = await dependencies.readinessChecks.redis();
      }

      if (dependencies.readinessChecks?.kafka) {
        checks.kafka = await dependencies.readinessChecks.kafka();
      }

      if (dependencies.readinessChecks?.rabbitmq) {
        checks.rabbitmq = await dependencies.readinessChecks.rabbitmq();
      }

      const ready = Object.values(checks).every(Boolean);

      response.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'not-ready',
        service: 'notification-engine',
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          error,
        },
        'Readiness check failed',
      );

      response.status(503).json({
        status: 'not-ready',
        service: 'notification-engine',
      });
    }
  });

  /**
   * Provider health
   */
  app.get('/health/providers', async (_request, response) => {
    if (!dependencies.providerHealthService) {
      response.status(503).json({
        status: 'unavailable',
        message: 'Provider health service not configured',
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

  /**
   * Event ingestion
   */
  app.post('/api/v1/events', async (request, response) => {
    if (!dependencies.notificationProducer) {
      response.status(503).json({
        status: 'unavailable',
        message: 'Notification producer is not configured',
      });

      return;
    }

    try {
      const event = validateEvent(request.body);

      const eventLogger = createCorrelationLogger(logger, {
        correlationId: event.correlation_id,
      });

      eventLogger.info(
        {
          eventId: event.event_id,
          eventType: event.event_type,
          userId: event.user_id,
        },
        'Notification event accepted',
      );

      await dependencies.notificationProducer.publish(event);

      response.status(202).json({
        eventId: event.event_id,
        status: 'accepted',
      });
    } catch (error) {
      logger.error(
        {
          error,
        },
        'Notification event failed',
      );

      response.status(400).json({
        status: 'error',
        message: 'Invalid notification event',
      });
    }
  });

  /**
   * Preferences
   */
  const preferenceService = new PreferenceService(
    new InMemoryPreferenceStore(),
    new InMemoryPreferenceCache(),
  );

  const handlers = createPreferenceHandlers(preferenceService);

  app.get('/users/:id/preferences', handlers.get);

  app.put('/users/:id/preferences', handlers.put);

  /**
   * DLQ dashboard
   */
  if (dependencies.dlqDashboardService) {
    app.use(createDlqDashboardRouter(dependencies.dlqDashboardService));
  }

  /**
   * Analytics
   */
  const analyticsApi = dependencies.analyticsApi;

  if (analyticsApi) {
    app.get('/analytics/delivery-rates', async (request, response) => {
      response.json(await analyticsApi.getDeliveryRates(request.query));
    });

    app.get('/analytics/channel-performance', async (request, response) => {
      response.json(await analyticsApi.getChannelPerformance(request.query));
    });

    app.get('/analytics/opt-out-trends', async (request, response) => {
      response.json(await analyticsApi.getOptOutTrends(request.query));
    });

    app.get('/analytics/costs', async (request, response) => {
      response.json(await analyticsApi.getCosts(request.query));
    });
  }

  /**
   * Prometheus
   */
  if (dependencies.prometheusMetricsService) {
    app.get('/metrics', async (_request, response) => {
      const metrics = await dependencies.prometheusMetricsService!.render();

      response.status(200).type('text/plain').send(metrics);
    });
  }

  /**
   * Global error handler
   */
  app.use(
    (
      error: unknown,
      request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      void next;

      logger.error(
        {
          error,
          method: request.method,
          path: request.originalUrl,
        },
        'Unhandled application error',
      );

      response.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    },
  );

  return app;
}
