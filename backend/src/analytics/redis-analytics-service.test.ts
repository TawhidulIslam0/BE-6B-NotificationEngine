import { describe, expect, it, vi } from 'vitest';

import { RedisAnalyticsService } from './redis-analytics-service.js';

const createRedisMock = () => {
  const store = new Map<string, string>();

  const hashes = new Map<string, Map<string, string>>();

  const sortedSets = new Map<string, Map<string, number>>();

  const redis = {
    incr: vi.fn(async (key: string) => {
      const current = Number(store.get(key) ?? 0) + 1;

      store.set(key, String(current));

      return current;
    }),

    incrby: vi.fn(async (key: string, amount: number) => {
      const current = Number(store.get(key) ?? 0) + amount;

      store.set(key, String(current));

      return current;
    }),

    get: vi.fn(async (key: string) => store.get(key) ?? null),

    expire: vi.fn(async () => 1),

    pexpire: vi.fn(async () => 1),

    hincrby: vi.fn(async (key: string, field: string, amount: number) => {
      let hash = hashes.get(key);

      if (!hash) {
        hash = new Map<string, string>();

        hashes.set(key, hash);
      }

      const current = Number(hash.get(field) ?? 0) + amount;

      hash.set(field, String(current));

      return current;
    }),

    hgetall: vi.fn(async (key: string) => {
      const hash = hashes.get(key);

      if (!hash) {
        return {};
      }

      return Object.fromEntries(hash.entries());
    }),

    zadd: vi.fn(async (key: string, score: number, member: string) => {
      let set = sortedSets.get(key);

      if (!set) {
        set = new Map<string, number>();

        sortedSets.set(key, set);
      }

      set.set(member, score);

      return 1;
    }),

    zrange: vi.fn(async (key: string) => {
      const set = sortedSets.get(key);

      if (!set) {
        return [];
      }

      return [...set.entries()]
        .sort(([, firstScore], [, secondScore]) => firstScore - secondScore)
        .map(([member]) => member);
    }),
  };

  return redis;
};

describe('RedisAnalyticsService', () => {
  it('records delivery and failure counters', async () => {
    const redis = createRedisMock();

    const service = new RedisAnalyticsService(redis as never);

    await service.record({
      channel: 'email',
      status: 'delivered',
    });

    await service.record({
      channel: 'email',
      status: 'failed',
    });

    const counters = await service.getDeliveryCounters();

    const delivered = counters.find(
      (counter) =>
        counter.channel === 'email' && counter.status === 'delivered',
    );

    const failed = counters.find(
      (counter) => counter.channel === 'email' && counter.status === 'failed',
    );

    expect(delivered?.count).toBe(1);

    expect(failed?.count).toBe(1);

    const failures = await service.getFailureCounters();

    expect(failures.find((failure) => failure.channel === 'email')?.count).toBe(
      1,
    );
  });

  it('tracks latency metrics per channel', async () => {
    const redis = createRedisMock();

    const service = new RedisAnalyticsService(redis as never);

    await service.record({
      channel: 'sms',
      status: 'delivered',
      latencyMs: 100,
    });

    await service.record({
      channel: 'sms',
      status: 'delivered',
      latencyMs: 300,
    });

    const metrics = await service.getLatencyMetrics();

    const sms = metrics.find((metric) => metric.channel === 'sms');

    expect(sms?.count).toBe(2);

    expect(sms?.totalMs).toBe(400);

    expect(sms?.averageMs).toBe(200);

    expect(sms?.minMs).toBe(100);

    expect(sms?.maxMs).toBe(300);
  });

  it('creates hourly, daily, and weekly aggregation buckets', async () => {
    const redis = createRedisMock();

    const service = new RedisAnalyticsService(redis as never);

    const timestamp = new Date('2026-09-17T14:30:00Z');

    await service.record({
      channel: 'push',
      status: 'delivered',
      latencyMs: 250,
      timestamp,
    });

    const hourly = await service.getWindow('hourly', timestamp);

    const daily = await service.getWindow('daily', timestamp);

    const weekly = await service.getWindow('weekly', timestamp);

    expect(hourly['total:push']).toBe('1');

    expect(hourly['delivered:push']).toBe('1');

    expect(hourly['latency_count:push']).toBe('1');

    expect(hourly['latency_sum:push']).toBe('250');

    expect(daily['total:push']).toBe('1');

    expect(weekly['total:push']).toBe('1');
  });

  it('calculates channel performance', async () => {
    const redis = createRedisMock();

    const service = new RedisAnalyticsService(redis as never);

    await service.record({
      channel: 'whatsapp',
      status: 'delivered',
      latencyMs: 200,
    });

    await service.record({
      channel: 'whatsapp',
      status: 'failed',
      latencyMs: 400,
    });

    const performance = await service.getChannelPerformance();

    const whatsapp = performance.find((item) => item.channel === 'whatsapp');

    expect(whatsapp).toEqual({
      channel: 'whatsapp',
      total: 2,
      delivered: 1,
      failed: 1,
      deliveryRate: 0.5,
      averageLatencyMs: 300,
    });
  });

  it('rejects invalid latency values', async () => {
    const redis = createRedisMock();

    const service = new RedisAnalyticsService(redis as never);

    await expect(
      service.record({
        channel: 'email',
        status: 'delivered',
        latencyMs: -1,
      }),
    ).rejects.toThrow('Latency must be a non-negative finite number');
  });
});
