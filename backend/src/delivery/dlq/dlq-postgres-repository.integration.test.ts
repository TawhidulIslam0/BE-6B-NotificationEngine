import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { database } from '../../infrastructure/postgres/client.js';

import { DlqPostgresRepository } from './dlq-postgres-repository.js';

describe('DlqPostgresRepository - PostgreSQL integration', () => {
  const repository = new DlqPostgresRepository(database);

  const eventId = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    await database('dead_letter_queue').where('event_id', eventId).del();
  });

  afterAll(async () => {
    await database('dead_letter_queue').where('event_id', eventId).del();

    await database.destroy();
  });

  it('inserts and retrieves a DLQ entry from PostgreSQL', async () => {
    const entry = {
      eventId,
      eventType: 'notification.email',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        message: 'Test notification',
      },
      reason: '[transient] Provider timeout',
      retryCount: 3,
      status: 'pending' as const,
      nextRetryAt: null,
    };

    await repository.insert(entry);

    const result = await repository.findByEventId(eventId);

    expect(result).not.toBeNull();

    expect(result).toEqual({
      eventId,
      eventType: 'notification.email',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        message: 'Test notification',
      },
      reason: '[transient] Provider timeout',
      retryCount: 3,
      status: 'pending',
      nextRetryAt: null,
    });
  });

  it('returns null for a missing DLQ event', async () => {
    const result = await repository.findByEventId(
      '22222222-2222-4222-8222-222222222222',
    );

    expect(result).toBeNull();
  });

  it('stores the payload as PostgreSQL JSONB', async () => {
    const jsonbEventId = '33333333-3333-4333-8333-333333333333';

    const entry = {
      eventId: jsonbEventId,
      eventType: 'notification.sms',
      payload: {
        userId: 'user-456',
        phone: '+15555555555',
        metadata: {
          source: 'integration-test',
          attempt: 3,
        },
      },
      reason: '[permanent] Invalid recipient',
      retryCount: 2,
      status: 'pending' as const,
      nextRetryAt: null,
    };

    await repository.insert(entry);

    const row = await database('dead_letter_queue')
      .where('event_id', jsonbEventId)
      .first();

    expect(row).toBeDefined();
    expect(row.event_type).toBe('notification.sms');
    expect(row.payload).toEqual(entry.payload);
    expect(row.retry_count).toBe(2);
    expect(row.status).toBe('pending');

    await database('dead_letter_queue').where('event_id', jsonbEventId).del();
  });
});
