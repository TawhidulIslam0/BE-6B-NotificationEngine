import { describe, expect, it } from 'vitest';

import { WhatsAppProvider } from './whatsapp-provider.js';
import type { PreparedNotification } from './types.js';

const notification = (
  channel: PreparedNotification['channel'] = 'whatsapp',
  overrides: Partial<PreparedNotification> = {},
): PreparedNotification => ({
  id: 'notification-whatsapp-001',
  userId: 'user-001',
  channel,
  recipient: '+14155550123',
  subject: 'Test notification',
  body: 'Test WhatsApp message.',
  ...overrides,
});

describe('WhatsAppProvider', () => {
  it('rejects non-WhatsApp notifications', async () => {
    const provider = new WhatsAppProvider();

    await expect(provider.send(notification('email'))).rejects.toThrow(
      'WhatsAppProvider only supports WhatsApp notifications',
    );
  });

  it('rejects an invalid WhatsApp recipient', async () => {
    const provider = new WhatsAppProvider();

    await expect(
      provider.send(
        notification('whatsapp', {
          recipient: '4155550123',
        }),
      ),
    ).rejects.toThrow('WhatsApp recipient must use international phone format');
  });

  it('sends notifications in test mode', async () => {
    const provider = new WhatsAppProvider({
      providerName: 'test-whatsapp',
      testMode: true,
    });

    const receipt = await provider.send(
      notification('whatsapp', {
        metadata: {
          source: 'test',
        },
      }),
    );

    expect(receipt).toMatchObject({
      externalId: 'whatsapp-test-notification-whatsapp-001',
      status: 'accepted',
      provider: 'test-whatsapp',
      rawResponse: {
        testMode: true,
        recipient: '+14155550123',
        body: 'Test WhatsApp message.',
        metadata: {
          source: 'test',
        },
      },
    });
  });

  it('requires phoneNumberId and accessToken outside test mode', async () => {
    const provider = new WhatsAppProvider();

    await expect(provider.send(notification())).rejects.toThrow(
      'WhatsApp phoneNumberId and accessToken are required outside test mode',
    );
  });

  it('uses the default API version', async () => {
    let requestUrl = '';

    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      fetcher: async (input) => {
        requestUrl = String(input);

        return new Response(
          JSON.stringify({
            messages: [{ id: 'whatsapp-message-001' }],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    });

    await provider.send(notification());

    expect(requestUrl).toBe(
      'https://graph.facebook.com/v20.0/mock-phone-number-id/messages',
    );
  });

  it('uses a custom API version and sends the expected payload', async () => {
    let requestUrl = '';
    let capturedBody: Record<string, unknown> | undefined;

    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      apiVersion: 'v21.0',
      fetcher: async (input, init) => {
        requestUrl = String(input);
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;

        return new Response(
          JSON.stringify({
            messages: [{ id: 'whatsapp-message-002' }],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    });

    const receipt = await provider.send(notification());

    expect(receipt).toMatchObject({
      externalId: 'whatsapp-message-002',
      status: 'accepted',
      provider: 'whatsapp-cloud-api',
    });

    expect(requestUrl).toBe(
      'https://graph.facebook.com/v21.0/mock-phone-number-id/messages',
    );

    expect(capturedBody).toMatchObject({
      messaging_product: 'whatsapp',
      to: '+14155550123',
      type: 'text',
      text: {
        preview_url: false,
        body: 'Test WhatsApp message.',
      },
    });
  });

  it('uses the default external ID when the response has no message ID', async () => {
    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            messages: [{}],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    });

    const receipt = await provider.send(notification());

    expect(receipt.externalId).toBe('whatsapp-notification-whatsapp-001');
  });

  it('uses the default external ID when messages are missing', async () => {
    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      fetcher: async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    });

    const receipt = await provider.send(notification());

    expect(receipt.externalId).toBe('whatsapp-notification-whatsapp-001');
  });

  it('parses an API error with an error message', async () => {
    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            error: {
              message: 'WHATSAPP_INVALID_TOKEN',
            },
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'WHATSAPP_INVALID_TOKEN',
    );
  });

  it('uses the HTTP status when an API error has no message', async () => {
    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            error: {},
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'WhatsApp API request failed with status 503',
    );
  });

  it('returns unknown status for an external notification ID', async () => {
    const provider = new WhatsAppProvider({
      providerName: 'test-whatsapp',
    });

    await expect(provider.getStatus('whatsapp-message-001')).resolves.toEqual({
      externalId: 'whatsapp-message-001',
      status: 'unknown',
      provider: 'test-whatsapp',
    });
  });

  it('returns an empty quota', async () => {
    const provider = new WhatsAppProvider();

    await expect(provider.getQuota()).resolves.toEqual({});
  });

  it('accepts a valid international phone number', async () => {
    const provider = new WhatsAppProvider();

    await expect(provider.validateRecipient('+14155550123')).resolves.toEqual({
      valid: true,
    });
  });

  it('accepts a valid number with surrounding whitespace', async () => {
    const provider = new WhatsAppProvider();

    await expect(
      provider.validateRecipient('  +14155550123  '),
    ).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects an invalid phone number', async () => {
    const provider = new WhatsAppProvider();

    await expect(provider.validateRecipient('4155550123')).resolves.toEqual({
      valid: false,
      reason:
        'WhatsApp recipient must use international phone format, for example +14155552671',
    });
  });

  it('reports healthy in test mode', async () => {
    const provider = new WhatsAppProvider({
      providerName: 'test-whatsapp',
      testMode: true,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'test-whatsapp',
      healthy: true,
      message: 'WhatsApp provider is available in test mode',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports unhealthy when phoneNumberId or accessToken is missing', async () => {
    const provider = new WhatsAppProvider({
      providerName: 'whatsapp-provider',
      phoneNumberId: 'mock-phone-number-id',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'whatsapp-provider',
      healthy: false,
      message:
        'WhatsApp phoneNumberId and accessToken are required for health checks',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports healthy when WhatsApp configuration is present', async () => {
    const provider = new WhatsAppProvider({
      providerName: 'whatsapp-provider',
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'whatsapp-provider',
      healthy: true,
      message: 'WhatsApp Cloud API configuration is present',
    });
    expect(health.checkedAt).toBeTruthy();
  });
});
