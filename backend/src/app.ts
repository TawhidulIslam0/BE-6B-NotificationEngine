import express from 'express';

import {
  createPreferenceHandlers,
  PreferenceService,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
} from './preferences/index.js';

import type { ProviderHealthService } from './delivery/health/provider-health-service.js';

export function createApp(providerHealthService?: ProviderHealthService) {
  const app = express();

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'notification-engine',
    });
  });

  app.get('/health/providers', async (_request, response) => {
    if (providerHealthService === undefined) {
      response.status(503).json({
        status: 'unavailable',
        service: 'notification-engine',
        message: 'Provider health service is not configured',
      });
      return;
    }

    const health = await providerHealthService.checkAll();

    response.status(health.healthy ? 200 : 503).json({
      status: health.healthy ? 'ok' : 'degraded',
      service: 'notification-engine',
      checkedAt: health.checkedAt,
      providers: health.providers,
    });
  });

  const service = new PreferenceService(
    new InMemoryPreferenceStore(),
    new InMemoryPreferenceCache(),
  );

  const handlers = createPreferenceHandlers(service);

  app.get('/users/:id/preferences', handlers.get);

  app.put('/users/:id/preferences', handlers.put);

  return app;
}
