import { describe, expect, it } from 'vitest';

import { PushProvider } from './push-provider.js';
import type { PreparedNotification } from './types.js';

const notification = (
  channel: PreparedNotification['channel'] = 'push',
  overrides: Partial<PreparedNotification> = {},
): PreparedNotification => ({
  id: 'notification-push-001',
  userId: 'user-001',
  channel,
  recipient: 'fcm-device-token-001',
  subject: 'Test notification',
  body: 'Test push message.',
  ...overrides,
});

describe('PushProvider', () => {
  it('rejects non-push notifications', async () => {
    const provider = new PushProvider();

    await expect(provider.send(notification('email'))).rejects.toThrow(
      'PushProvider only supports push notifications',
    );
  });

  it('rejects an empty device token', async () => {
    const provider = new PushProvider();

    await expect(
      provider.send(notification('push', { recipient: '   ' })),
    ).rejects.toThrow('FCM device token cannot be empty');
  });

  it('sends notifications in test mode', async () => {
    const provider = new PushProvider({
      providerName: 'test-fcm',
      testMode: true,
    });

    const receipt = await provider.send(
      notification('push', {
        metadata: {
          source: 'test',
          attempt: 1,
        },
      }),
    );

    expect(receipt).toMatchObject({
      externalId: 'fcm-test-notification-push-001',
      status: 'accepted',
      provider: 'test-fcm',
      rawResponse: {
        testMode: true,
        token: 'fcm-device-token-001',
        notification: {
          title: 'Test notification',
          body: 'Test push message.',
        },
        data: {
          source: 'test',
          attempt: 1,
        },
      },
    });
  });

  it('requires projectId and accessToken outside test mode', async () => {
    const provider = new PushProvider();

    await expect(provider.send(notification())).rejects.toThrow(
      'FCM projectId and accessToken are required outside test mode',
    );
  });

  it('sends FCM metadata as a string map', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const provider = new PushProvider({
      projectId: 'mock project',
      accessToken: 'fcm-test-token',
      fetcher: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;

        return new Response(
          JSON.stringify({
            name: 'projects/mock-project/messages/fcm-message-001',
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

    const receipt = await provider.send(
      notification('push', {
        metadata: {
          stringValue: 'hello',
          numberValue: 42,
          objectValue: {
            source: 'test',
          },
        },
      }),
    );

    expect(receipt.externalId).toBe(
      'projects/mock-project/messages/fcm-message-001',
    );
    expect(capturedBody).toMatchObject({
      message: {
        token: 'fcm-device-token-001',
        data: {
          stringValue: 'hello',
          numberValue: '42',
          objectValue: '{"source":"test"}',
        },
      },
    });
  });

  it('uses an empty metadata map when metadata is undefined', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      fetcher: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;

        return new Response(JSON.stringify({ name: 'fcm-message-001' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      },
    });

    await provider.send(notification());

    expect(capturedBody).toMatchObject({
      message: {
        data: {},
      },
    });
  });

  it('uses the default notification title when subject is undefined', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      fetcher: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;

        return new Response(JSON.stringify({ name: 'fcm-message-001' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      },
    });

    await provider.send(
      notification('push', {
        subject: undefined,
      }),
    );

    expect(capturedBody).toMatchObject({
      message: {
        notification: {
          title: 'Notification',
        },
      },
    });
  });

  it('parses an FCM error response with an error message', async () => {
    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            error: {
              message: 'FCM_INVALID_ARGUMENT',
            },
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'FCM_INVALID_ARGUMENT',
    );
  });

  it('uses the HTTP status when an FCM error has no message', async () => {
    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
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
      'FCM request failed with status 503',
    );
  });

  it('uses a fallback external ID when FCM omits name', async () => {
    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      fetcher: async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    });

    const receipt = await provider.send(notification());

    expect(receipt.externalId).toBe('fcm-notification-push-001');
  });

  it('returns unknown status for an external notification ID', async () => {
    const provider = new PushProvider({
      providerName: 'test-fcm',
    });

    await expect(provider.getStatus('fcm-message-001')).resolves.toEqual({
      externalId: 'fcm-message-001',
      status: 'unknown',
      provider: 'test-fcm',
    });
  });

  it('returns an empty quota', async () => {
    const provider = new PushProvider();

    await expect(provider.getQuota()).resolves.toEqual({});
  });

  it('accepts a non-empty device token', async () => {
    const provider = new PushProvider();

    await expect(
      provider.validateRecipient('fcm-device-token-001'),
    ).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects an empty device token during validation', async () => {
    const provider = new PushProvider();

    await expect(provider.validateRecipient('   ')).resolves.toEqual({
      valid: false,
      reason: 'FCM device token cannot be empty',
    });
  });

  it('reports healthy in test mode', async () => {
    const provider = new PushProvider({
      providerName: 'test-fcm',
      testMode: true,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'test-fcm',
      healthy: true,
      message: 'Push provider is available in test mode',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports unhealthy when projectId or accessToken is missing', async () => {
    const provider = new PushProvider({
      providerName: 'fcm-provider',
      projectId: 'mock-project',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'fcm-provider',
      healthy: false,
      message: 'FCM projectId and accessToken are required for health checks',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports healthy when FCM configuration is present', async () => {
    const provider = new PushProvider({
      providerName: 'fcm-provider',
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'fcm-provider',
      healthy: true,
      message: 'FCM HTTP v1 configuration is present',
    });
    expect(health.checkedAt).toBeTruthy();
  });
});
