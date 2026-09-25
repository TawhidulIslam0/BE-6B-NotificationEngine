import { describe, expect, it, vi } from 'vitest';

import type Redis from 'ioredis';

import type { PreparedNotification } from '../providers/types.js';

import { RetryBudgetMonitor } from './retry-budget.js';

import { RetryScheduler } from './retry-scheduler.js';

import {
  RetryWorker,
  type RetryDeliveryService,
  type RetryNotificationRepository,
} from './retry-worker.js';

describe('RetryWorker', () => {
  const createRedisMock = (initialRetryBudgetUsage = 0) => {
    let retryBudgetUsage = initialRetryBudgetUsage;

    return {
      zadd: vi.fn().mockResolvedValue(1),

      zrangebyscore: vi.fn().mockResolvedValue([]),

      zrem: vi.fn().mockResolvedValue(1),

      incrby: vi
        .fn()
        .mockImplementation(async (_key: string, amount: number) => {
          retryBudgetUsage += amount;

          return retryBudgetUsage;
        }),

      pexpire: vi.fn().mockResolvedValue(1),

      get: vi.fn().mockImplementation(async () => String(retryBudgetUsage)),
    };
  };

  const createNotification = (): PreparedNotification => ({
    id: 'notification-123',
    userId: 'user-123',
    channel: 'email',
    recipient: 'user@example.com',
    subject: 'Test notification',
    body: 'Test notification body',
  });

  const createJob = () => ({
    notificationId: 'notification-123',

    eventId: 'event-123',

    eventType: 'notification.email',

    payload: {
      userId: 'user-123',
      email: 'user@example.com',
      message: 'Test notification',
    },

    priority: 'high' as const,

    attempt: 0,

    retryAt: new Date('2026-01-01T00:00:01.000Z'),
  });

  const createDlqProcessor = () =>
    ({
      processFailure: vi.fn().mockResolvedValue({
        entry: {
          eventId: 'event-123',

          eventType: 'notification.email',

          payload: {
            userId: 'user-123',

            email: 'user@example.com',

            message: 'Test notification',
          },

          reason: '[transient] Provider unavailable',

          retryCount: 5,

          status: 'pending',

          nextRetryAt: null,
        },

        classification: 'transient',

        reason: '[transient] Provider unavailable',
      }),
    }) as unknown as ConstructorParameters<typeof RetryWorker>[3];

  it('delivers a notification successfully and removes the retry job', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis);

    const notification = createNotification();

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(notification),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = createJob();

    const result = await worker.processJob(job);

    expect(deliveryService.send).toHaveBeenCalledWith(notification);

    expect(redis.zrem).toHaveBeenCalledWith(
      'notification:retry:queue',
      JSON.stringify(job),
    );

    expect(result).toEqual({
      notificationId: 'notification-123',

      attempt: 0,

      success: true,

      retryScheduled: false,
    });

    expect(dlqProcessor.processFailure).not.toHaveBeenCalled();

    expect(redis.incrby).not.toHaveBeenCalled();
  });

  it('schedules another retry when delivery fails and the retry budget is available', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis, {
      windowMs: 60_000,

      maxRetries: 1_000,
    });

    const notification = createNotification();

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(notification),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = createJob();

    const result = await worker.processJob(job);

    expect(redis.incrby).toHaveBeenCalledTimes(1);

    expect(redis.zadd).toHaveBeenCalledTimes(1);

    expect(redis.zadd).toHaveBeenCalledWith(
      'notification:retry:queue',
      expect.any(Number),
      expect.stringContaining('"eventId":"event-123"'),
    );

    expect(redis.zadd).toHaveBeenCalledWith(
      'notification:retry:queue',
      expect.any(Number),
      expect.stringContaining('"eventType":"notification.email"'),
    );

    expect(redis.zadd).toHaveBeenCalledWith(
      'notification:retry:queue',
      expect.any(Number),
      expect.stringContaining('"payload":{"userId":"user-123"'),
    );

    expect(result.success).toBe(false);

    expect(result.retryScheduled).toBe(true);

    expect(result.error).toBe('Provider unavailable');

    expect(result.retryAt).toBeInstanceOf(Date);

    expect(dlqProcessor.processFailure).not.toHaveBeenCalled();
  });

  it('moves a notification to the DLQ when maximum retries are exhausted', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis);

    const notification = createNotification();

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(notification),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = {
      ...createJob(),
      attempt: 5,
    };

    const result = await worker.processJob(job);

    expect(dlqProcessor.processFailure).toHaveBeenCalledWith({
      eventId: 'event-123',

      eventType: 'notification.email',

      payload: {
        userId: 'user-123',

        email: 'user@example.com',

        message: 'Test notification',
      },

      failure: {
        error: expect.any(Error),

        retryCount: 5,
      },
    });

    expect(redis.incrby).not.toHaveBeenCalled();

    expect(redis.zadd).not.toHaveBeenCalled();

    expect(redis.zrem).toHaveBeenCalledWith(
      'notification:retry:queue',
      JSON.stringify(job),
    );

    expect(result).toEqual({
      notificationId: 'notification-123',

      attempt: 5,

      success: false,

      retryScheduled: false,

      error: 'Provider unavailable',

      dlqClassification: 'transient',
    });
  });

  it('moves a notification to the DLQ when the retry budget is exhausted', async () => {
    /*
     * Start with one retry already used.
     * The budget limit is also one, so the
     * next retry exceeds the budget.
     */
    const redis = createRedisMock(1);

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis, {
      windowMs: 60_000,

      maxRetries: 1,
    });

    const notification = createNotification();

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(notification),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = createJob();

    const result = await worker.processJob(job);

    expect(redis.incrby).toHaveBeenCalledTimes(1);

    expect(redis.zadd).not.toHaveBeenCalled();

    expect(dlqProcessor.processFailure).toHaveBeenCalledTimes(1);

    expect(dlqProcessor.processFailure).toHaveBeenCalledWith({
      eventId: 'event-123',

      eventType: 'notification.email',

      payload: {
        userId: 'user-123',

        email: 'user@example.com',

        message: 'Test notification',
      },

      failure: {
        error: expect.any(Error),

        retryCount: 0,
      },
    });

    expect(redis.zrem).toHaveBeenCalledWith(
      'notification:retry:queue',
      JSON.stringify(job),
    );

    expect(result).toEqual({
      notificationId: 'notification-123',

      attempt: 0,

      success: false,

      retryScheduled: false,

      error: 'Retry budget exhausted',

      dlqClassification: 'transient',
    });
  });

  it('does not retry when the maximum retry count has been reached', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis);

    const notification = createNotification();

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(notification),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = {
      ...createJob(),
      attempt: 5,
    };

    const result = await worker.processJob(job);

    expect(redis.zadd).not.toHaveBeenCalled();

    expect(redis.incrby).not.toHaveBeenCalled();

    expect(dlqProcessor.processFailure).toHaveBeenCalledTimes(1);

    expect(result.success).toBe(false);

    expect(result.retryScheduled).toBe(false);

    expect(result.error).toBe('Provider unavailable');

    expect(result.dlqClassification).toBe('transient');
  });

  it('removes a retry job when its notification no longer exists', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis);

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn(),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const job = createJob();

    const result = await worker.processJob(job);

    expect(deliveryService.send).not.toHaveBeenCalled();

    expect(redis.zrem).toHaveBeenCalledWith(
      'notification:retry:queue',
      JSON.stringify(job),
    );

    expect(dlqProcessor.processFailure).not.toHaveBeenCalled();

    expect(redis.incrby).not.toHaveBeenCalled();

    expect(result.success).toBe(false);

    expect(result.retryScheduled).toBe(false);

    expect(result.error).toBe('Notification not found');
  });

  it('processes all due retry jobs', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const retryBudget = new RetryBudgetMonitor(redis as unknown as Redis);

    const job1 = createJob();

    const job2 = {
      ...createJob(),

      notificationId: 'notification-456',

      eventId: 'event-456',

      eventType: 'notification.sms',

      payload: {
        userId: 'user-456',

        phone: '+15555555555',

        message: 'Test SMS',
      },
    };

    redis.zrangebyscore.mockResolvedValue([
      JSON.stringify(job1),
      JSON.stringify(job2),
    ]);

    const notification1 = createNotification();

    const notification2 = {
      ...notification1,
      id: 'notification-456',
    };

    const repository: RetryNotificationRepository = {
      findById: vi.fn().mockImplementation(async (notificationId) => {
        if (notificationId === 'notification-123') {
          return notification1;
        }

        return notification2;
      }),
    };

    const deliveryService: RetryDeliveryService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const dlqProcessor = createDlqProcessor();

    const worker = new RetryWorker(
      scheduler,
      repository,
      deliveryService,
      dlqProcessor,
      retryBudget,
    );

    const results = await worker.processDueJobs(
      new Date('2026-01-01T00:00:05.000Z'),
    );

    expect(redis.zrangebyscore).toHaveBeenCalledWith(
      'notification:retry:queue',
      0,
      new Date('2026-01-01T00:00:05.000Z').getTime(),
    );

    expect(results).toHaveLength(2);

    expect(deliveryService.send).toHaveBeenCalledTimes(2);

    expect(dlqProcessor.processFailure).not.toHaveBeenCalled();

    expect(redis.incrby).not.toHaveBeenCalled();
  });
});
