import { describe, expect, it } from 'vitest';

import { RetryBudgetMonitor } from './retry-budget.js';

interface MockRedis {
  values: Map<string, number>;
  expirations: Map<string, number>;
  incrby(key: string, amount: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
}

const createMockRedis = (): MockRedis => {
  const values = new Map<string, number>();

  const expirations = new Map<string, number>();

  return {
    values,
    expirations,

    async incrby(key: string, amount: number): Promise<number> {
      const current = values.get(key) ?? 0;

      const updated = current + amount;

      values.set(key, updated);

      return updated;
    },

    async pexpire(key: string, milliseconds: number): Promise<number> {
      expirations.set(key, milliseconds);

      return 1;
    },

    async get(key: string): Promise<string | null> {
      const value = values.get(key);

      return value === undefined ? null : String(value);
    },
  };
};

describe('RetryBudgetMonitor', () => {
  it('uses the default budget configuration', () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never);

    expect(monitor.getConfig()).toEqual({
      windowMs: 60_000,
      maxRetries: 1_000,
    });
  });

  it('accepts custom budget configuration', () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 30_000,
      maxRetries: 100,
    });

    expect(monitor.getConfig()).toEqual({
      windowMs: 30_000,
      maxRetries: 100,
    });
  });

  it('creates a Redis key for the current time window', () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 100,
    });

    const now = new Date('2026-09-14T12:34:56.789Z');

    const windowStart = Math.floor(now.getTime() / 60_000) * 60_000;

    expect(monitor.getKey(windowStart)).toBe(
      `notification:retry:budget:${windowStart}`,
    );
  });

  it('allows retries while the budget remains available', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 3,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    const allowed = await monitor.consume(1, now);

    expect(allowed).toBe(true);

    const status = await monitor.getStatus(now);

    expect(status.used).toBe(1);
    expect(status.limit).toBe(3);
    expect(status.remaining).toBe(2);
  });

  it('allows a retry that exactly reaches the budget', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 3,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    expect(await monitor.consume(2, now)).toBe(true);

    expect(await monitor.consume(1, now)).toBe(true);

    const status = await monitor.getStatus(now);

    expect(status.used).toBe(3);
    expect(status.remaining).toBe(0);
  });

  it('blocks retries after the budget is exceeded', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 3,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    expect(await monitor.consume(3, now)).toBe(true);

    expect(await monitor.consume(1, now)).toBe(false);

    const status = await monitor.getStatus(now);

    expect(status.used).toBe(4);
    expect(status.remaining).toBe(0);
  });

  it('tracks different time windows separately', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 2,
    });

    const firstWindow = new Date('2026-09-14T12:34:30.000Z');

    const secondWindow = new Date('2026-09-14T12:35:30.000Z');

    expect(await monitor.consume(2, firstWindow)).toBe(true);

    expect(await monitor.consume(1, secondWindow)).toBe(true);

    const firstStatus = await monitor.getStatus(firstWindow);

    const secondStatus = await monitor.getStatus(secondWindow);

    expect(firstStatus.used).toBe(2);

    expect(secondStatus.used).toBe(1);
  });

  it('sets the Redis key expiration when the first retry is recorded', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 100,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    await monitor.consume(1, now);

    const key = monitor.getKey(Math.floor(now.getTime() / 60_000) * 60_000);

    expect(redis.expirations.get(key)).toBe(60_000);
  });

  it('does not reset the expiration on subsequent increments', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 100,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    await monitor.consume(1, now);

    await monitor.consume(1, now);

    const key = monitor.getKey(Math.floor(now.getTime() / 60_000) * 60_000);

    expect(redis.expirations.get(key)).toBe(60_000);
  });

  it('reports zero usage when no retries have been recorded', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 10,
    });

    const status = await monitor.getStatus(
      new Date('2026-09-14T12:34:56.000Z'),
    );

    expect(status.used).toBe(0);
    expect(status.limit).toBe(10);
    expect(status.remaining).toBe(10);
  });

  it('checks whether a retry would fit within the remaining budget', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 5,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    await monitor.consume(3, now);

    expect(await monitor.isAllowed(2, now)).toBe(true);

    expect(await monitor.isAllowed(3, now)).toBe(false);
  });

  it('rejects an invalid retry count', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never);

    await expect(monitor.consume(0)).rejects.toThrow(
      'Retry count must be a positive integer',
    );

    await expect(monitor.consume(-1)).rejects.toThrow(
      'Retry count must be a positive integer',
    );

    await expect(monitor.consume(1.5)).rejects.toThrow(
      'Retry count must be a positive integer',
    );
  });

  it('supports consuming multiple retry units at once', async () => {
    const redis = createMockRedis();

    const monitor = new RetryBudgetMonitor(redis as never, {
      windowMs: 60_000,
      maxRetries: 10,
    });

    const now = new Date('2026-09-14T12:34:56.000Z');

    expect(await monitor.consume(4, now)).toBe(true);

    const status = await monitor.getStatus(now);

    expect(status.used).toBe(4);
    expect(status.remaining).toBe(6);
  });
});
