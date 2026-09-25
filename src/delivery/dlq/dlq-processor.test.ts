import { describe, expect, it, vi } from 'vitest';

import { FailureClassifier } from './failure-classifier.js';

import { DlqProcessor, type DlqRepository } from './dlq-processor.js';

describe('DlqProcessor', () => {
  const createRepository = (): DlqRepository => ({
    insert: vi.fn().mockResolvedValue(undefined),
  });

  it('stores a transient failure in the DLQ', async () => {
    const repository = createRepository();

    const processor = new DlqProcessor(repository, new FailureClassifier());

    const result = await processor.processFailure({
      eventId: 'event-123',
      eventType: 'notification.email',
      payload: {
        userId: 'user-123',
      },
      failure: {
        error: new Error('Provider timeout'),
        retryCount: 3,
      },
    });

    expect(repository.insert).toHaveBeenCalledWith({
      eventId: 'event-123',
      eventType: 'notification.email',
      payload: {
        userId: 'user-123',
      },
      reason: '[transient] Provider timeout',
      retryCount: 3,
      status: 'pending',
      nextRetryAt: null,
    });

    expect(result.classification).toBe('transient');
  });

  it('stores a permanent failure in the DLQ', async () => {
    const repository = createRepository();

    const processor = new DlqProcessor(repository, new FailureClassifier());

    const result = await processor.processFailure({
      eventId: 'event-456',
      eventType: 'notification.sms',
      payload: {
        phone: '+15555555555',
      },
      failure: {
        error: new Error('Invalid recipient'),
        retryCount: 2,
      },
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-456',
        reason: '[permanent] Invalid recipient',
        retryCount: 2,
        status: 'pending',
      }),
    );

    expect(result.classification).toBe('permanent');
  });

  it('stores a configuration failure in the DLQ', async () => {
    const repository = createRepository();

    const processor = new DlqProcessor(repository, new FailureClassifier());

    const result = await processor.processFailure({
      eventId: 'event-789',
      eventType: 'notification.push',
      payload: {
        userId: 'user-789',
      },
      failure: {
        error: new Error('API key is missing'),
        retryCount: 0,
      },
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-789',
        reason: '[configuration] API key is missing',
        retryCount: 0,
        status: 'pending',
      }),
    );

    expect(result.classification).toBe('configuration');
  });

  it('preserves the original notification payload', async () => {
    const repository = createRepository();

    const processor = new DlqProcessor(repository, new FailureClassifier());

    const payload = {
      userId: 'user-123',
      amount: 2500,
      currency: 'USD',
    };

    await processor.processFailure({
      eventId: 'event-payload',
      eventType: 'notification.payment',
      payload,
      failure: {
        error: new Error('Provider unavailable'),
        retryCount: 4,
      },
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-payload',
        payload,
      }),
    );
  });
});
