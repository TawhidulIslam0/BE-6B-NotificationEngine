import { describe, expect, it } from 'vitest';
import type { PreparedNotification } from '../providers/types.js';
import {
  ChannelRoutingEngine,
  ChannelScoring,
  CostOptimizer,
  DeliveryMetrics,
  RegulatoryOverride,
} from './index.js';

const createNotification = (): PreparedNotification => ({
  id: 'notification-001',
  userId: 'user-001',
  channel: 'email',
  recipient: 'user@example.com',
  subject: 'Test notification',
  body: 'Test notification body',
});

describe('ChannelRoutingEngine', () => {
  const createEngine = (
    metrics: DeliveryMetrics = new DeliveryMetrics(),
  ): ChannelRoutingEngine =>
    new ChannelRoutingEngine(
      new RegulatoryOverride(),
      new ChannelScoring(metrics, new CostOptimizer()),
    );

  it('applies regulatory override before user preferences', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'REGX-003',
      eventCategory: 'REGX',
      availableChannels: ['sms', 'email', 'push'],
      preferences: {
        userId: 'user-001',
        eventCategory: 'REGX',
        channels: {
          sms: {
            enabled: false,
            priority: 5,
          },
          email: {
            enabled: true,
            priority: 1,
          },
          push: {
            enabled: true,
            priority: 5,
          },
        },
      },
    });

    expect(decision.regulatoryOverride).toBe(true);
    expect(decision.selectedChannel).toBe('email');
  });

  it('ignores disabled user preference for normal events', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'TXNX-001',
      eventCategory: 'TXNX',
      availableChannels: ['sms', 'email', 'push'],
      preferences: {
        userId: 'user-001',
        eventCategory: 'TXNX',
        channels: {
          sms: {
            enabled: false,
            priority: 5,
          },
          email: {
            enabled: true,
            priority: 3,
          },
        },
      },
    });

    expect(decision.selectedChannel).not.toBe('sms');
  });

  it('uses delivery history to influence routing', () => {
    const metrics = new DeliveryMetrics([
      {
        userId: 'user-001',
        channel: 'whatsapp',
        sent: 100,
        delivered: 95,
        opened: 90,
        failed: 5,
      },
      {
        userId: 'user-001',
        channel: 'push',
        sent: 100,
        delivered: 30,
        opened: 5,
        failed: 70,
      },
    ]);

    const engine = createEngine(metrics);

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'MKTX-001',
      eventCategory: 'MKTX',
      availableChannels: ['push', 'whatsapp'],
    });

    expect(decision.selectedChannel).toBe('whatsapp');
  });

  it('returns candidates ranked by score', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'TXNX-001',
      eventCategory: 'TXNX',
      availableChannels: ['sms', 'email', 'push'],
    });

    expect(decision.candidates.length).toBeGreaterThan(0);

    for (let index = 1; index < decision.candidates.length; index += 1) {
      expect(decision.candidates[index - 1].score).toBeGreaterThanOrEqual(
        decision.candidates[index].score,
      );
    }
  });

  it('returns null when all channels are disabled', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'TXNX-001',
      eventCategory: 'TXNX',
      availableChannels: ['sms', 'email'],
      preferences: {
        userId: 'user-001',
        eventCategory: 'TXNX',
        channels: {
          sms: {
            enabled: false,
            priority: 5,
          },
          email: {
            enabled: false,
            priority: 5,
          },
        },
      },
    });

    expect(decision.selectedChannel).toBeNull();

    expect(decision.reason).toBe('No eligible delivery channel available');
  });

  it('respects cost budgets during routing', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'TXNX-001',
      eventCategory: 'TXNX',
      availableChannels: ['sms', 'email'],
      budget: {
        userId: 'user-001',
        dailyLimitPaisa: 10,
        dailySpentPaisa: 10,
        monthlyLimitPaisa: 100,
        monthlySpentPaisa: 20,
      },
    });

    expect(decision.selectedChannel).not.toBe('sms');
  });

  it('preserves regulatory routing even when the user disables the channel', () => {
    const engine = createEngine();

    const decision = engine.route({
      notification: createNotification(),
      eventType: 'REGX-003',
      eventCategory: 'REGX',
      availableChannels: ['email', 'push'],
      preferences: {
        userId: 'user-001',
        eventCategory: 'REGX',
        channels: {
          email: {
            enabled: false,
            priority: 0,
          },
          push: {
            enabled: true,
            priority: 5,
          },
        },
      },
    });

    expect(decision.selectedChannel).toBe('email');
    expect(decision.regulatoryOverride).toBe(true);
  });
});
