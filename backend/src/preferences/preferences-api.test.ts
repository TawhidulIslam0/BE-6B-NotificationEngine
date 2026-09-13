import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createPreferenceHandlers,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
  PreferenceService,
} from './index.js';

function createTestApp() {
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

describe('User preference REST API', () => {
  it('GET /users/:id/preferences returns default preferences', async () => {
    const app = createTestApp();

    const response = await request(app).get('/users/user-api-1/preferences');

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('user-api-1');
    expect(response.body.locale).toBe('en');
    expect(response.body.channels.email.enabled).toBe(true);
  });

  it('PUT /users/:id/preferences updates preferences', async () => {
    const app = createTestApp();

    const response = await request(app)
      .put('/users/user-api-2/preferences')
      .send({
        locale: 'hi',
        timezone: 'Asia/Kolkata',
      });

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('user-api-2');
    expect(response.body.locale).toBe('hi');
    expect(response.body.timezone).toBe('Asia/Kolkata');
  });

  it('GET returns the updated preferences after PUT', async () => {
    const app = createTestApp();

    await request(app).put('/users/user-api-3/preferences').send({
      locale: 'mr',
    });

    const response = await request(app).get('/users/user-api-3/preferences');

    expect(response.status).toBe(200);
    expect(response.body.locale).toBe('mr');
  });

  it('PUT rejects an invalid locale', async () => {
    const app = createTestApp();

    const response = await request(app)
      .put('/users/user-api-4/preferences')
      .send({
        locale: 'invalid-locale',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
