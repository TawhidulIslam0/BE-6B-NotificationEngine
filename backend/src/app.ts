import express from 'express';

import {
  createPreferenceHandlers,
  PreferenceService,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
} from './preferences/index.js';

import type { ProviderHealthService } from './delivery/health/provider-health-service.js';

import type { DlqDashboardService } from './delivery/dlq/dlq-dashboard-service.js';

import { createDlqDashboardRouter } from './delivery/dlq/dlq-dashboard-api.js';

export interface AppDependencies {
  providerHealthService?: ProviderHealthService;
  dlqDashboardService?: DlqDashboardService;
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

  return app;
}
