import { describe, expect, it, vi } from 'vitest';

import { DlqPostgresRepository } from './dlq-postgres-repository.js';

describe('DlqPostgresRepository', () => {
  it('inserts a DLQ entry into PostgreSQL', async () => {
    const insert = vi.fn().mockResolvedValue(undefined);

    const query = {
      insert,
    };

    const db = vi.fn().mockReturnValue(query);

    const repository = new DlqPostgresRepository(db as never);

    const entry = {
      eventId: 'event-123',
      eventType: 'notification.email',
      payload: {
        userId: 'user-123',
      },
      reason: '[transient] Provider timeout',
      retryCount: 3,
      status: 'pending' as const,
      nextRetryAt: null,
    };

    await repository.insert(entry);

    expect(db).toHaveBeenCalledWith('dead_letter_queue');

    expect(insert).toHaveBeenCalledWith({
      event_id: 'event-123',
      event_type: 'notification.email',
      payload: {
        userId: 'user-123',
      },
      reason: '[transient] Provider timeout',
      retry_count: 3,
      status: 'pending',
      next_retry_at: null,
    });
  });

  it('finds a DLQ entry by event ID', async () => {
    const first = vi.fn().mockResolvedValue({
      event_id: 'event-456',
      event_type: 'notification.sms',
      payload: {
        phone: '+15555555555',
      },
      reason: '[permanent] Invalid recipient',
      retry_count: 2,
      status: 'pending',
      next_retry_at: null,
    });

    const where = vi.fn().mockReturnValue({
      first,
    });

    const query = {
      where,
    };

    const db = vi.fn().mockReturnValue(query);

    const repository = new DlqPostgresRepository(db as never);

    const result = await repository.findByEventId('event-456');

    expect(db).toHaveBeenCalledWith('dead_letter_queue');

    expect(where).toHaveBeenCalledWith('event_id', 'event-456');

    expect(result).toEqual({
      eventId: 'event-456',
      eventType: 'notification.sms',
      payload: {
        phone: '+15555555555',
      },
      reason: '[permanent] Invalid recipient',
      retryCount: 2,
      status: 'pending',
      nextRetryAt: null,
    });
  });

  it('returns null when the event does not exist', async () => {
    const first = vi.fn().mockResolvedValue(undefined);

    const where = vi.fn().mockReturnValue({
      first,
    });

    const db = vi.fn().mockReturnValue({
      where,
    });

    const repository = new DlqPostgresRepository(db as never);

    const result = await repository.findByEventId('missing-event');

    expect(result).toBeNull();
  });
});
