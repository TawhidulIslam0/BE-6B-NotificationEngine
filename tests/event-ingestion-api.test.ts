import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

import type { NotificationProducer } from '../src/events/producer/notification-producer.js';

const validEvent = {
  event_id: 'event-api-1',
  event_type: 'user.welcome',
  event_version: '1.0',
  occurred_at: '2026-09-20T16:00:00.000Z',
  user_id: 'user-1',
  correlation_id: 'correlation-1',
  source: 'load-test',
  priority: 'normal',
  payload: {
    name: 'Test User',
  },
};

describe('POST /api/v1/events', () => {
  it('publishes a valid event to Kafka and returns 202', async () => {
    const producer = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const app = createApp({
      notificationProducer: producer as unknown as NotificationProducer,
    });

    const response = await request(app).post('/api/v1/events').send(validEvent);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      eventId: 'event-api-1',
      status: 'accepted',
    });

    expect(producer.publish).toHaveBeenCalledTimes(1);
    expect(producer.publish).toHaveBeenCalledWith(validEvent);
  });

  it('rejects an invalid event with 400', async () => {
    const producer = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const app = createApp({
      notificationProducer: producer as unknown as NotificationProducer,
    });

    const response = await request(app)
      .post('/api/v1/events')
      .send({
        ...validEvent,
        event_type: 'not-a-real-event',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Invalid notification event',
    });

    expect(producer.publish).not.toHaveBeenCalled();
  });

  it('returns 503 when the producer is not configured', async () => {
    const app = createApp();

    const response = await request(app).post('/api/v1/events').send(validEvent);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'unavailable',
      message: 'Notification producer is not configured',
    });
  });
});
