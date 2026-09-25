import { describe, expect, it, vi } from 'vitest';

import { InAppProvider } from './in-app-provider.js';
import type { PreparedNotification } from './types.js';

const notification = (
  channel: PreparedNotification['channel'] = 'in-app',
  overrides: Partial<PreparedNotification> = {},
): PreparedNotification => ({
  id: 'notification-in-app-001',
  userId: 'user-001',
  channel,
  recipient: 'user-001',
  subject: 'Test notification',
  body: 'Test in-app message.',
  ...overrides,
});

describe('InAppProvider', () => {
  it('requires a Socket.io notification server outside test mode', () => {
    expect(() => new InAppProvider()).toThrow(
      'socketNotificationServer is required outside test mode',
    );
  });

  it('allows construction without a Socket.io server in test mode', () => {
    expect(
      () =>
        new InAppProvider({
          testMode: true,
        }),
    ).not.toThrow();
  });

  it('rejects non-in-app notifications', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.send(notification('email'))).rejects.toThrow(
      'InAppProvider only supports in-app notifications',
    );
  });

  it('emits notifications in test mode', async () => {
    const provider = new InAppProvider({
      providerName: 'test-in-app',
      testMode: true,
    });

    const prepared = notification();

    const receipt = await provider.send(prepared);

    expect(provider.emittedNotifications).toEqual([prepared]);
    expect(receipt).toMatchObject({
      externalId: 'in-app-test-notification-in-app-001',
      status: 'delivered',
      provider: 'test-in-app',
      rawResponse: {
        testMode: true,
        recipient: 'user-001',
      },
    });
  });

  it('uses the default provider name', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    const receipt = await provider.send(notification());

    expect(receipt.provider).toBe('socket-io-in-app');
  });

  it('sends a notification through the Socket.io server', async () => {
    const sendToUser = vi.fn();

    const provider = new InAppProvider({
      providerName: 'socket-provider',
      socketNotificationServer: {
        sendToUser,
      } as never,
    });

    const receipt = await provider.send(notification());

    expect(sendToUser).toHaveBeenCalledOnce();
    expect(sendToUser).toHaveBeenCalledWith('user-001', {
      recipient: 'user-001',
      notification: {
        id: 'notification-in-app-001',
        userId: 'user-001',
        channel: 'in-app',
        recipient: 'user-001',
        subject: 'Test notification',
        body: 'Test in-app message.',
      },
    });

    expect(receipt).toMatchObject({
      externalId: 'in-app-notification-in-app-001',
      status: 'accepted',
      provider: 'socket-provider',
      rawResponse: {
        recipient: 'user-001',
        transport: 'socket.io',
      },
    });
  });

  it('uses an empty subject when the notification subject is undefined', async () => {
    const sendToUser = vi.fn();

    const provider = new InAppProvider({
      socketNotificationServer: {
        sendToUser,
      } as never,
    });

    await provider.send(
      notification('in-app', {
        subject: undefined,
      }),
    );

    expect(sendToUser).toHaveBeenCalledWith(
      'user-001',
      expect.objectContaining({
        notification: expect.objectContaining({
          subject: '',
        }),
      }),
    );
  });

  it('guards against a missing Socket.io server', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    Object.defineProperty(provider, 'options', {
      value: {
        testMode: false,
      },
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'Socket.io notification server is not configured',
    );
  });

  it('returns unknown status for an external notification ID', async () => {
    const provider = new InAppProvider({
      providerName: 'test-in-app',
      testMode: true,
    });

    await expect(provider.getStatus('in-app-message-001')).resolves.toEqual({
      externalId: 'in-app-message-001',
      status: 'unknown',
      provider: 'test-in-app',
    });
  });

  it('accepts a non-empty recipient', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.validateRecipient('user-001')).resolves.toEqual({
      valid: true,
    });
  });

  it('accepts a recipient containing surrounding whitespace', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.validateRecipient('  user-001  ')).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects an empty recipient', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.validateRecipient('')).resolves.toEqual({
      valid: false,
      reason: 'In-app recipient cannot be empty',
    });
  });

  it('rejects a whitespace-only recipient', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.validateRecipient('   ')).resolves.toEqual({
      valid: false,
      reason: 'In-app recipient cannot be empty',
    });
  });

  it('returns an empty quota', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    await expect(provider.getQuota()).resolves.toEqual({});
  });

  it('reports healthy in test mode', async () => {
    const provider = new InAppProvider({
      providerName: 'test-in-app',
      testMode: true,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'test-in-app',
      healthy: true,
      message: 'In-app provider is available in test mode',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports unhealthy when the Socket.io server is not configured', async () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    Object.defineProperty(provider, 'options', {
      value: {
        testMode: false,
      },
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      healthy: false,
      message: 'Socket.io notification server is not configured',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports healthy when the Socket.io server is configured', async () => {
    const provider = new InAppProvider({
      providerName: 'socket-provider',
      socketNotificationServer: {
        sendToUser: vi.fn(),
      } as never,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'socket-provider',
      healthy: true,
      message: 'Socket.io notification server is configured',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('disconnects without throwing', () => {
    const provider = new InAppProvider({
      testMode: true,
    });

    expect(() => provider.disconnect()).not.toThrow();
  });
});
