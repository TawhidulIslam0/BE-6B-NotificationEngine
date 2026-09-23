import { describe, expect, it } from 'vitest';

import { SmsProvider } from './sms-provider.js';
import type { PreparedNotification } from './types.js';

const notification = (
  channel: PreparedNotification['channel'] = 'sms',
): PreparedNotification => ({
  id: 'notification-sms-001',
  userId: 'user-001',
  channel,
  recipient: '+14155550123',
  subject: 'Test notification',
  body: 'Test SMS message.',
});

describe('SmsProvider', () => {
  it('rejects non-SMS notifications', async () => {
    const provider = new SmsProvider();

    await expect(provider.send(notification('email'))).rejects.toThrow(
      'SmsProvider only supports SMS notifications',
    );
  });

  it('sends notifications in test mode', async () => {
    const provider = new SmsProvider({
      providerName: 'test-sms',
      testMode: true,
    });

    const receipt = await provider.send(notification());

    expect(receipt).toMatchObject({
      externalId: 'sms-test-notification-sms-001',
      status: 'accepted',
      provider: 'test-sms',
      rawResponse: {
        testMode: true,
        recipient: '+14155550123',
        body: 'Test SMS message.',
      },
    });
  });

  it('requires apiUrl outside test mode', async () => {
    const provider = new SmsProvider();

    await expect(provider.send(notification())).rejects.toThrow(
      'apiUrl is required outside test mode',
    );
  });

  it('sends without an API key when one is not configured', async () => {
    const originalFetch = globalThis.fetch;
    let authorizationHeader: string | null = null;

    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      authorizationHeader = headers.get('Authorization');

      return new Response(
        JSON.stringify({
          messageId: 'sms-message-no-key',
          status: 'accepted',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    };

    try {
      const provider = new SmsProvider({
        apiUrl: 'https://sms.example.test/send',
      });

      const receipt = await provider.send(notification());

      expect(receipt.externalId).toBe('sms-message-no-key');
      expect(authorizationHeader).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses a fallback external ID when the provider omits messageId', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'accepted',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

    try {
      const provider = new SmsProvider({
        apiUrl: 'https://sms.example.test/send',
      });

      const receipt = await provider.send(notification());

      expect(receipt.externalId).toBe('sms-notification-sms-001');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns delivered status in test mode', async () => {
    const provider = new SmsProvider({
      providerName: 'test-sms',
      testMode: true,
    });

    await expect(provider.getStatus('sms-message-001')).resolves.toEqual({
      externalId: 'sms-message-001',
      status: 'delivered',
      provider: 'test-sms',
    });
  });

  it('rejects status checks outside test mode', async () => {
    const provider = new SmsProvider();

    await expect(provider.getStatus('sms-message-001')).rejects.toThrow(
      'SMS status endpoint is not configured',
    );
  });

  it('accepts valid E.164 recipients', async () => {
    const provider = new SmsProvider();

    await expect(provider.validateRecipient('+14155550123')).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects invalid SMS recipients', async () => {
    const provider = new SmsProvider();

    await expect(provider.validateRecipient('4155550123')).resolves.toEqual({
      valid: false,
      reason: 'SMS recipient must use international E.164 format',
    });
  });

  it('returns an empty quota', async () => {
    const provider = new SmsProvider();

    await expect(provider.getQuota()).resolves.toEqual({});
  });

  it('reports healthy in test mode', async () => {
    const provider = new SmsProvider({
      providerName: 'test-sms',
      testMode: true,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'test-sms',
      healthy: true,
      message: 'SMS provider is available in test mode',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports unhealthy when apiUrl is not configured', async () => {
    const provider = new SmsProvider({
      providerName: 'sms-provider',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'sms-provider',
      healthy: false,
      message: 'SMS provider API URL is not configured',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports healthy when apiUrl is configured', async () => {
    const provider = new SmsProvider({
      providerName: 'sms-provider',
      apiUrl: 'https://sms.example.test/send',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'sms-provider',
      healthy: true,
      message: 'SMS provider configuration is present',
    });
    expect(health.checkedAt).toBeTruthy();
  });
});
