import { afterAll, describe, expect, it } from 'vitest';

import { FailureClassifier } from '../dlq/failure-classifier.js';

import { DlqPostgresRepository } from '../dlq/dlq-postgres-repository.js';

import { DlqProcessor } from '../dlq/dlq-processor.js';

import { database } from '../../infrastructure/postgres/client.js';

import type { PreparedNotification } from '../providers/types.js';

import { RetryBudgetMonitor } from './retry-budget.js';

import {
  RetryPolicyService,
  RetryScheduler,
  RetryWorker,
  type RetryJob,
} from './index.js';

describe('RetryWorker → PostgreSQL DLQ integration', () => {
  const dlqRepository = new DlqPostgresRepository(database);

  const dlqProcessor = new DlqProcessor(dlqRepository, new FailureClassifier());

  const policyService = new RetryPolicyService();

  it('inserts an exhausted retry into PostgreSQL DLQ', async () => {
    const eventId = '44444444-4444-4444-8444-444444444444';

    const notificationId = '55555555-5555-4555-8555-555555555555';

    const userId = '66666666-6666-4666-8666-666666666666';

    const payload = {
      userId,
      channel: 'email',
      recipient: 'user@example.com',
    };

    const redis = {
      zadd: async () => 1,

      zrangebyscore: async () => [],

      zrem: async () => 1,

      incrby: async () => 1,

      pexpire: async () => 1,

      get: async () => '1',
    } as never;

    const scheduler = new RetryScheduler(redis, policyService);

    const retryBudget = new RetryBudgetMonitor(redis, {
      windowMs: 60_000,
      maxRetries: 1_000,
    });

    const notification: PreparedNotification = {
      id: notificationId,
      userId,
      channel: 'email',
      recipient: 'user@example.com',
      subject: 'Test notification',
      body: 'Test body',
    };

    const repository = {
      findById: async (): Promise<PreparedNotification> => notification,
    };

    const deliveryService = {
      send: async () => {
        throw new Error('Provider unavailable');
      },
    };

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job: RetryJob = {
      notificationId,
      eventId,
      eventType: 'notification.email.send',
      payload,
      priority: 'high',
      attempt: policyService.getPolicy('high').maxRetries,
      retryAt: new Date(),
    };

    try {
      const result = await worker.processJob(job);

      expect(result.success).toBe(false);

      expect(result.retryScheduled).toBe(false);

      expect(result.dlqClassification).toBe('transient');

      const dlqEntry = await dlqRepository.findByEventId(eventId);

      expect(dlqEntry).not.toBeNull();

      expect(dlqEntry).toMatchObject({
        eventId,
        eventType: 'notification.email.send',
        payload,
        reason: '[transient] Provider unavailable',
        retryCount: job.attempt,
        status: 'pending',
        nextRetryAt: null,
      });
    } finally {
      await database('dead_letter_queue').where('event_id', eventId).del();
    }
  });
});

afterAll(async () => {
  await database.destroy();
});
