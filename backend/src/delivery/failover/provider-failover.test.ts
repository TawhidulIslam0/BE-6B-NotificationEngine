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

import { IdempotencyStore, ProviderFailover } from './index.js';

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
      externalId: `${this.providerName}-001`,
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

const notification: PreparedNotification = {
  id: 'notification-001',
  userId: 'user-001',
  channel: 'sms',
  recipient: '+14155550123',
  subject: 'Test',
  body: 'Test',
};

const breaker = (provider: string): CircuitBreaker =>
  new CircuitBreaker({
    provider,
    thresholds: {
      failureRateThreshold: 1,
      responseTimeThresholdMs: 10000,
      minimumRequests: 10,
      openStateDurationMs: 1000,
    },
  });

describe('ProviderFailover', () => {
  it('fails over from MSG91 to Twilio', async () => {
    const msg91 = new MockProvider('MSG91', true);

    const twilio = new MockProvider('Twilio', false);

    const service = new ProviderFailover(new IdempotencyStore());

    const result = await service.send(notification, {
      channel: 'sms',
      providers: [
        {
          providerName: 'MSG91',
          provider: msg91,
          circuitBreaker: breaker('MSG91'),
        },
        {
          providerName: 'Twilio',
          provider: twilio,
          circuitBreaker: breaker('Twilio'),
        },
      ],
    });

    expect(result.provider).toBe('Twilio');
    expect(result.failedOver).toBe(true);
    expect(result.attempts).toHaveLength(2);

    expect(msg91.sendCount).toBe(1);
    expect(twilio.sendCount).toBe(1);
  });

  it('fails over from FCM to APNS', async () => {
    const fcm = new MockProvider('FCM', true);

    const apns = new MockProvider('APNS', false);

    const service = new ProviderFailover(new IdempotencyStore());

    const pushNotification: PreparedNotification = {
      ...notification,
      id: 'notification-push-001',
      channel: 'push',
      recipient: 'device-token-001',
    };

    const result = await service.send(pushNotification, {
      channel: 'push',
      providers: [
        {
          providerName: 'FCM',
          provider: fcm,
          circuitBreaker: breaker('FCM'),
        },
        {
          providerName: 'APNS',
          provider: apns,
          circuitBreaker: breaker('APNS'),
        },
      ],
    });

    expect(result.provider).toBe('APNS');
    expect(result.failedOver).toBe(true);
    expect(result.attempts).toHaveLength(2);

    expect(result.attempts[0]).toMatchObject({
      provider: 'FCM',
      success: false,
    });

    expect(result.attempts[1]).toMatchObject({
      provider: 'APNS',
      success: true,
    });

    expect(fcm.sendCount).toBe(1);
    expect(apns.sendCount).toBe(1);
  });

  it('prevents duplicate delivery on retry', async () => {
    const msg91 = new MockProvider('MSG91', false);

    const service = new ProviderFailover(new IdempotencyStore());

    const config = {
      channel: 'sms' as const,
      providers: [
        {
          providerName: 'MSG91',
          provider: msg91,
          circuitBreaker: breaker('MSG91'),
        },
      ],
    };

    await service.send(notification, config);
    await service.send(notification, config);

    expect(msg91.sendCount).toBe(1);
  });
});
