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
  IdempotencyStore,
  MultiChannelDispatcher,
  ProviderFailover,
} from './index.js';

class MockProvider implements DeliveryProvider {
  public sendCount = 0;

  public constructor(
    private readonly providerName: string,
    private readonly delayMs: number,
  ) {}

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    this.sendCount += 1;

    if (notification.id.length === 0) {
      throw new Error('Notification ID is required');
    }

    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

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
      healthy: true,
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

describe('MultiChannelDispatcher', () => {
  it('fans out delivery across multiple channels simultaneously', async () => {
    const smsProvider = new MockProvider('Twilio', 100);
    const emailProvider = new MockProvider('SendGrid', 100);
    const pushProvider = new MockProvider('FCM', 100);

    const providerFailover = new ProviderFailover(new IdempotencyStore());

    const dispatcher = new MultiChannelDispatcher(providerFailover);

    const notification: PreparedNotification = {
      id: 'notification-fanout-001',
      userId: 'user-001',
      channel: 'email',
      recipient: 'user@example.com',
      subject: 'Test notification',
      body: 'Test notification body',
    };

    const providerConfigs = new Map([
      [
        'sms' as const,
        {
          channel: 'sms' as const,
          providers: [
            {
              providerName: 'Twilio',
              provider: smsProvider,
              circuitBreaker: createBreaker('Twilio'),
            },
          ],
        },
      ],
      [
        'email' as const,
        {
          channel: 'email' as const,
          providers: [
            {
              providerName: 'SendGrid',
              provider: emailProvider,
              circuitBreaker: createBreaker('SendGrid'),
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
              provider: pushProvider,
              circuitBreaker: createBreaker('FCM'),
            },
          ],
        },
      ],
    ]);

    const startedAt = Date.now();

    const results = await dispatcher.dispatch(
      notification,
      ['sms', 'email', 'push'],
      providerConfigs,
    );

    const elapsedMs = Date.now() - startedAt;

    expect(results).toHaveLength(3);

    expect(results.map((result) => result.channel)).toEqual(
      expect.arrayContaining(['sms', 'email', 'push']),
    );

    expect(smsProvider.sendCount).toBe(1);
    expect(emailProvider.sendCount).toBe(1);
    expect(pushProvider.sendCount).toBe(1);

    expect(
      results.every((result) => result.result.receipt.status === 'accepted'),
    ).toBe(true);

    // Three 100ms deliveries should overlap through Promise.all().
    // Allow timing variance while still detecting sequential execution.
    expect(elapsedMs).toBeLessThan(250);
  });
});
