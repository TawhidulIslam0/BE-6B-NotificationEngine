import { describe, expect, it } from 'vitest';

import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from '../providers/types.js';

import { CircuitBreaker } from '../circuit-breaker/circuit-breaker.js';

import {
  ChannelFailover,
  IdempotencyStore,
  ProviderFailover,
} from './index.js';

class MockProvider implements DeliveryProvider {
  public sendCount = 0;

  public constructor(
    private readonly providerName: string,
    private readonly shouldFail: boolean,
  ) {}

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    this.sendCount += 1;

    if (notification.id.length === 0) {
      throw new Error('Notification ID is required');
    }

    if (this.shouldFail) {
      throw new Error(`${this.providerName} failed`);
    }

    return {
      externalId: `${this.providerName}-${notification.channel}-001`,
      status: 'accepted',
      provider: this.providerName,
    };
  }

  public async getStatus(externalId: string): Promise<DeliveryReceipt> {
    return {
      externalId,
      status: 'delivered',
      provider: this.providerName,
    };
  }

  public async validateRecipient(
    address: string,
  ): Promise<RecipientValidationResult> {
    return {
      valid: address.length > 0,
    };
  }

  public async getQuota(): Promise<ProviderQuota> {
    return {};
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.providerName,
      healthy: !this.shouldFail,
      checkedAt: new Date().toISOString(),
    };
  }
}

const createBreaker = (provider: string): CircuitBreaker =>
  new CircuitBreaker({
    provider,
    thresholds: {
      failureRateThreshold: 1,
      responseTimeThresholdMs: 10000,
      minimumRequests: 10,
      openStateDurationMs: 1000,
    },
  });

describe('Failover simulation', () => {
  it('fails over from the primary channel and then from FCM to APNS', async () => {
    const emailProvider = new MockProvider('EmailProvider', true);

    const fcm = new MockProvider('FCM', true);

    const apns = new MockProvider('APNS', false);

    const providerFailover = new ProviderFailover(new IdempotencyStore());

    const channelFailover = new ChannelFailover(providerFailover);

    const notification: PreparedNotification = {
      id: 'notification-simulation-001',
      userId: 'user-001',
      channel: 'email',
      recipient: 'user@example.com',
      subject: 'Failover simulation',
      body: 'Testing complete failover chain',
    };

    const candidates = [
      {
        channel: 'email' as const,
        score: 0.9,
        preferenceScore: 1,
        deliveryScore: 0.9,
        costScore: 0.8,
        estimatedCostPaisa: 3,
        eligible: true,
      },
      {
        channel: 'push' as const,
        score: 0.8,
        preferenceScore: 0.8,
        deliveryScore: 0.8,
        costScore: 1,
        estimatedCostPaisa: 0,
        eligible: true,
      },
    ];

    const providerConfigs = new Map([
      [
        'email' as const,
        {
          channel: 'email' as const,
          providers: [
            {
              providerName: 'EmailProvider',
              provider: emailProvider,
              circuitBreaker: createBreaker('EmailProvider'),
            },
          ],
        },
      ],
      [
        'push' as const,
        {
          channel: 'push' as const,
          providers: [
            {
              providerName: 'FCM',
              provider: fcm,
              circuitBreaker: createBreaker('FCM'),
            },
            {
              providerName: 'APNS',
              provider: apns,
              circuitBreaker: createBreaker('APNS'),
            },
          ],
        },
      ],
    ]);

    const result = await channelFailover.send(
      notification,
      candidates,
      providerConfigs,
    );

    expect(result.channel).toBe('push');
    expect(result.result.provider).toBe('APNS');
    expect(result.result.receipt.status).toBe('accepted');

    expect(result.failedOver).toBe(true);

    expect(result.attempts).toHaveLength(2);

    expect(result.attempts[0]).toMatchObject({
      channel: 'email',
      success: false,
    });

    expect(result.attempts[1]).toMatchObject({
      channel: 'push',
      success: true,
      provider: 'APNS',
    });

    expect(emailProvider.sendCount).toBe(1);
    expect(fcm.sendCount).toBe(1);
    expect(apns.sendCount).toBe(1);
  });

  it('does not retry a successfully delivered notification', async () => {
    const fcm = new MockProvider('FCM', false);

    const apns = new MockProvider('APNS', false);

    const providerFailover = new ProviderFailover(new IdempotencyStore());

    const notification: PreparedNotification = {
      id: 'notification-idempotency-001',
      userId: 'user-001',
      channel: 'push',
      recipient: 'device-token-001',
      subject: 'Idempotency simulation',
      body: 'Testing duplicate prevention',
    };

    const config = {
      channel: 'push' as const,
      providers: [
        {
          providerName: 'FCM',
          provider: fcm,
          circuitBreaker: createBreaker('FCM'),
        },
        {
          providerName: 'APNS',
          provider: apns,
          circuitBreaker: createBreaker('APNS'),
        },
      ],
    };

    const firstResult = await providerFailover.send(notification, config);

    const secondResult = await providerFailover.send(notification, config);

    expect(firstResult.provider).toBe('FCM');
    expect(secondResult.provider).toBe('FCM');

    expect(firstResult.receipt.status).toBe('accepted');

    expect(secondResult.receipt.status).toBe('accepted');

    expect(secondResult.receipt.rawResponse).toMatchObject({
      idempotentReplay: true,
    });

    expect(fcm.sendCount).toBe(1);
    expect(apns.sendCount).toBe(0);
  });
});
