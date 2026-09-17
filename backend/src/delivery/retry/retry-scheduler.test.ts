import { describe, expect, it, vi } from 'vitest';

import type Redis from 'ioredis';

import { RetryScheduler } from './retry-scheduler.js';

describe('RetryScheduler', () => {
  const createRedisMock = () => ({
    zadd: vi.fn().mockResolvedValue(1),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
  });

  it('adds a retry job to a Redis sorted set using retry timestamp as score', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const now = new Date('2026-01-01T00:00:00.000Z');

    const schedule = await scheduler.schedule(
      'notification-123',
      'critical',
      0,
      'event-123',
      'notification.email',
      {
        userId: 'user-123',
        message: 'Test notification',
      },
      now,
      () => 0,
    );

    expect(schedule.delayMs).toBe(500);

    expect(redis.zadd).toHaveBeenCalledWith(
      'notification:retry:queue',
      new Date('2026-01-01T00:00:00.500Z').getTime(),
      JSON.stringify({
        notificationId: 'notification-123',
        eventId: 'event-123',
        eventType: 'notification.email',
        payload: {
          userId: 'user-123',
          message: 'Test notification',
        },
        priority: 'critical',
        attempt: 0,
        retryAt: new Date('2026-01-01T00:00:00.500Z'),
      }),
    );
  });

  it('returns retry jobs whose timestamp is due', async () => {
    const job = {
      notificationId: 'notification-456',
      eventId: 'event-456',
      eventType: 'notification.sms',
      payload: {
        userId: 'user-456',
        phone: '+15555555555',
      },
      priority: 'high' as const,
      attempt: 1,
      retryAt: new Date('2026-01-01T00:00:02.000Z'),
    };

    const redis = createRedisMock();

    redis.zrangebyscore.mockResolvedValue([JSON.stringify(job)]);

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const jobs = await scheduler.getDueJobs(
      new Date('2026-01-01T00:00:03.000Z'),
    );

    expect(redis.zrangebyscore).toHaveBeenCalledWith(
      'notification:retry:queue',
      0,
      new Date('2026-01-01T00:00:03.000Z').getTime(),
    );

    expect(jobs).toEqual([job]);
  });

  it('removes a retry job from the Redis sorted set', async () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(redis as unknown as Redis);

    const job = {
      notificationId: 'notification-789',
      eventId: 'event-789',
      eventType: 'notification.email',
      payload: {
        userId: 'user-789',
        message: 'Test notification',
      },
      priority: 'low' as const,
      attempt: 1,
      retryAt: new Date('2026-01-01T00:01:00.000Z'),
    };

    const removed = await scheduler.removeJob(job);

    expect(redis.zrem).toHaveBeenCalledWith(
      'notification:retry:queue',
      JSON.stringify(job),
    );

    expect(removed).toBe(1);
  });

  it('uses the configured Redis queue key', () => {
    const redis = createRedisMock();

    const scheduler = new RetryScheduler(
      redis as unknown as Redis,
      undefined,
      'custom:retry:queue',
    );

    expect(scheduler.getQueueKey()).toBe('custom:retry:queue');
  });
});
