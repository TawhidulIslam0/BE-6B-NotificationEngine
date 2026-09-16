import { describe, expect, it } from 'vitest';
import { ChannelScoring } from './channel-scoring.js';
import { CostOptimizer } from './cost-optimizer.js';
import { DeliveryMetrics } from './delivery-metrics.js';

describe('ChannelScoring', () => {
  it('prefers a channel with a stronger user preference', () => {
    const metrics = new DeliveryMetrics([
      {
        userId: 'user-001',
        channel: 'push',
        sent: 100,
        delivered: 70,
        opened: 50,
        failed: 30,
      },
      {
        userId: 'user-001',
        channel: 'email',
        sent: 100,
        delivered: 90,
        opened: 50,
        failed: 10,
      },
    ]);

    const scoring = new ChannelScoring(metrics, new CostOptimizer());

    const candidates = scoring.rank('user-001', ['push', 'email'], {
      push: {
        enabled: true,
        priority: 5,
      },
      email: {
        enabled: true,
        priority: 1,
      },
    });

    expect(candidates[0]?.channel).toBe('push');
  });

  it('uses delivery history in the score', () => {
    const metrics = new DeliveryMetrics([
      {
        userId: 'user-001',
        channel: 'push',
        sent: 100,
        delivered: 95,
        opened: 80,
        failed: 5,
      },
      {
        userId: 'user-001',
        channel: 'email',
        sent: 100,
        delivered: 50,
        opened: 20,
        failed: 50,
      },
    ]);

    const scoring = new ChannelScoring(metrics, new CostOptimizer(), {
      preference: 0,
      delivery: 1,
      cost: 0,
    });

    const candidates = scoring.rank('user-001', ['push', 'email'], {});

    expect(candidates[0]?.channel).toBe('push');
    expect(candidates[0]?.deliveryScore).toBe(0.95);
  });

  it('prefers lower-cost channels when delivery is equal', () => {
    const metrics = new DeliveryMetrics([
      {
        userId: 'user-001',
        channel: 'sms',
        sent: 100,
        delivered: 90,
        opened: 0,
        failed: 10,
      },
      {
        userId: 'user-001',
        channel: 'email',
        sent: 100,
        delivered: 90,
        opened: 0,
        failed: 10,
      },
    ]);

    const scoring = new ChannelScoring(metrics, new CostOptimizer(), {
      preference: 0,
      delivery: 1,
      cost: 0,
    });

    const candidates = scoring.rank('user-001', ['sms', 'email'], {});

    expect(candidates).toHaveLength(2);

    const sms = candidates.find((candidate) => candidate.channel === 'sms');

    const email = candidates.find((candidate) => candidate.channel === 'email');

    expect(sms?.deliveryScore).toBe(email?.deliveryScore);

    expect(email?.estimatedCostPaisa).toBeLessThan(
      sms?.estimatedCostPaisa ?? Infinity,
    );
  });

  it('excludes disabled channels', () => {
    const scoring = new ChannelScoring(
      new DeliveryMetrics(),
      new CostOptimizer(),
    );

    const candidates = scoring.rank('user-001', ['sms', 'email'], {
      sms: {
        enabled: false,
        priority: 5,
      },
      email: {
        enabled: true,
        priority: 3,
      },
    });

    expect(candidates.some((candidate) => candidate.channel === 'sms')).toBe(
      false,
    );

    expect(candidates[0]?.channel).toBe('email');
  });

  it('rejects a channel when the user budget is exhausted', () => {
    const scoring = new ChannelScoring(
      new DeliveryMetrics(),
      new CostOptimizer(),
    );

    const candidates = scoring.rank(
      'user-001',
      ['sms', 'email'],
      {},
      {
        userId: 'user-001',
        dailyLimitPaisa: 10,
        dailySpentPaisa: 10,
        monthlyLimitPaisa: 100,
        monthlySpentPaisa: 20,
      },
    );

    expect(candidates.some((candidate) => candidate.channel === 'sms')).toBe(
      false,
    );
  });
});
