import express from 'express';
import {
  createPreferenceHandlers,
  PreferenceService,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
} from './preferences/index.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  const service = new PreferenceService(
    new InMemoryPreferenceStore(),
    new InMemoryPreferenceCache(),
  );

  const handlers = createPreferenceHandlers(service);

  app.get('/users/:id/preferences', handlers.get);

  app.put('/users/:id/preferences', handlers.put);

  return app;
}
