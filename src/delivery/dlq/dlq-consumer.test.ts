import { describe, expect, it, vi } from 'vitest';

import { DlqConsumer } from './dlq-consumer.js';

import type { DlqRetryRepository } from './dlq-consumer.js';

import type { RetryScheduler } from '../retry/retry-scheduler.js';

import type { DlqEntry } from './types.js';

const createEntry = (overrides: Partial<DlqEntry> = {}): DlqEntry => ({
  id: 'dlq-id-1',
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'notification.email.send',
  payload: {
    userId: 'user-1',
    recipient: 'user@example.com',
  },
  reason: '[transient] Provider unavailable',
  retryCount: 3,
  status: 'processing',
  nextRetryAt: new Date(),
  createdAt: new Date('2026-09-15T12:00:00Z'),
  resolvedAt: null,
  ...overrides,
});

describe('DlqConsumer', () => {
  it('requeues a DLQ entry', async () => {
    const entry = createEntry();

    const repository: DlqRetryRepository = {
      markForRetry: vi.fn().mockResolvedValue(entry),
    };

    const scheduler = {
      addToQueue: vi.fn().mockResolvedValue(undefined),
    };

    const consumer = new DlqConsumer(
      repository,
      scheduler as unknown as RetryScheduler,
    );

    const result = await consumer.retry('dlq-id-1', 'high');

    expect(result.entry).toEqual(entry);

    expect(result.scheduled).toBe(true);

    expect(repository.markForRetry).toHaveBeenCalledWith('dlq-id-1');

    expect(scheduler.addToQueue).toHaveBeenCalledWith(
      entry.eventId,
      'high',
      expect.objectContaining({
        attempt: 0,
        delayMs: 0,
        retryAt: expect.any(Date),
      }),
      entry.eventId,
      entry.eventType,
      entry.payload,
    );
  });

  it('defaults retry priority to normal', async () => {
    const entry = createEntry();

    const repository: DlqRetryRepository = {
      markForRetry: vi.fn().mockResolvedValue(entry),
    };

    const scheduler = {
      addToQueue: vi.fn().mockResolvedValue(undefined),
    };

    const consumer = new DlqConsumer(
      repository,
      scheduler as unknown as RetryScheduler,
    );

    await consumer.retry('dlq-id-1');

    expect(scheduler.addToQueue).toHaveBeenCalledWith(
      entry.eventId,
      'normal',
      expect.any(Object),
      entry.eventId,
      entry.eventType,
      entry.payload,
    );
  });

  it('throws when the DLQ entry cannot be marked for retry', async () => {
    const repository: DlqRetryRepository = {
      markForRetry: vi.fn().mockResolvedValue(null),
    };

    const scheduler = {
      addToQueue: vi.fn(),
    };

    const consumer = new DlqConsumer(
      repository,
      scheduler as unknown as RetryScheduler,
    );

    await expect(consumer.retry('missing-id')).rejects.toThrow(
      'DLQ entry missing-id not found or is not pending',
    );

    expect(scheduler.addToQueue).not.toHaveBeenCalled();
  });
});
