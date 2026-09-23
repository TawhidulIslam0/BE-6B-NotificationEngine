import { describe, expect, it, vi } from 'vitest';

import { EmailProvider } from './email-provider.js';
import type { PreparedNotification } from './types.js';

const notification = (
  channel: PreparedNotification['channel'] = 'email',
  overrides: Partial<PreparedNotification> = {},
): PreparedNotification => ({
  id: 'notification-email-001',
  userId: 'user-001',
  channel,
  recipient: 'recipient@example.com',
  subject: 'Test notification',
  body: 'Test email message.',
  ...overrides,
});

describe('EmailProvider', () => {
  it('rejects non-email notifications', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    await expect(provider.send(notification('sms'))).rejects.toThrow(
      'EmailProvider only supports email notifications',
    );
  });

  it('sends notifications in test mode', async () => {
    const provider = new EmailProvider({
      providerName: 'test-email',
      testMode: true,
    });

    const receipt = await provider.send(notification());

    expect(receipt).toMatchObject({
      externalId: 'email-test-notification-email-001',
      status: 'accepted',
      provider: 'test-email',
      rawResponse: {
        testMode: true,
        recipient: 'recipient@example.com',
        subject: 'Test notification',
        body: 'Test email message.',
      },
    });
  });

  it('uses the default subject in test mode when subject is undefined', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    const receipt = await provider.send(
      notification('email', {
        subject: undefined,
      }),
    );

    expect(receipt.rawResponse).toMatchObject({
      subject: 'Notification',
    });
  });

  it('requires SMTP configuration outside test mode', () => {
    expect(() => new EmailProvider()).toThrow(
      'Email SMTP host, username, and password are required outside test mode',
    );
  });

  it('creates an SMTP transporter when configuration is provided', () => {
    expect(
      () =>
        new EmailProvider({
          host: '127.0.0.1',
          username: 'sender@example.com',
          password: 'smtp-password',
        }),
    ).not.toThrow();
  });

  it('uses the configured transporter and sender address', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: '<message-001@example.com>',
      accepted: ['recipient@example.com'],
      rejected: [],
      response: '250 OK',
    });

    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as never;

    const provider = new EmailProvider({
      providerName: 'mock-email',
      username: 'sender@example.com',
      transporter,
    });

    const receipt = await provider.send(notification());

    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test notification',
      text: 'Test email message.',
    });

    expect(receipt).toMatchObject({
      externalId: '<message-001@example.com>',
      status: 'accepted',
      provider: 'mock-email',
      rawResponse: {
        messageId: '<message-001@example.com>',
        accepted: ['recipient@example.com'],
        rejected: [],
        response: '250 OK',
      },
    });
  });

  it('uses the configured fromAddress instead of username', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: '<message-002@example.com>',
      accepted: ['recipient@example.com'],
      rejected: [],
      response: '250 OK',
    });

    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as never;

    const provider = new EmailProvider({
      username: 'login@example.com',
      fromAddress: 'notifications@example.com',
      transporter,
    });

    await provider.send(notification());

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'notifications@example.com',
      }),
    );
  });

  it('uses the default subject when subject is undefined', async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: '<message-003@example.com>',
      accepted: ['recipient@example.com'],
      rejected: [],
      response: '250 OK',
    });

    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as never;

    const provider = new EmailProvider({
      username: 'sender@example.com',
      transporter,
    });

    await provider.send(
      notification('email', {
        subject: undefined,
      }),
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Notification',
      }),
    );
  });

  it('rejects sending when the transporter is not configured', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    Object.defineProperty(provider, 'transporter', {
      value: undefined,
    });

    Object.defineProperty(provider, 'options', {
      value: {
        testMode: false,
      },
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'Email transporter is not configured',
    );
  });

  it('rejects sending when the sender address is not configured', async () => {
    const sendMail = vi.fn();

    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as never;

    const provider = new EmailProvider({
      transporter,
    });

    await expect(provider.send(notification())).rejects.toThrow(
      'Email sender address is not configured',
    );

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns unknown status for an external notification ID', async () => {
    const provider = new EmailProvider({
      providerName: 'test-email',
      testMode: true,
    });

    await expect(provider.getStatus('email-message-001')).resolves.toEqual({
      externalId: 'email-message-001',
      status: 'unknown',
      provider: 'test-email',
    });
  });

  it('accepts a valid email recipient', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    await expect(
      provider.validateRecipient('recipient@example.com'),
    ).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects an invalid email recipient', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    await expect(provider.validateRecipient('not-an-email')).resolves.toEqual({
      valid: false,
      reason: 'Email recipient must be a valid email address',
    });
  });

  it('returns an empty quota', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    await expect(provider.getQuota()).resolves.toEqual({});
  });

  it('reports healthy in test mode', async () => {
    const provider = new EmailProvider({
      providerName: 'test-email',
      testMode: true,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'test-email',
      healthy: true,
      message: 'Email provider is available in test mode',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports unhealthy when the transporter is not configured', async () => {
    const provider = new EmailProvider({
      testMode: true,
    });

    Object.defineProperty(provider, 'transporter', {
      value: undefined,
    });

    Object.defineProperty(provider, 'options', {
      value: {
        testMode: false,
      },
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      healthy: false,
      message: 'Email transporter is not configured',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports healthy when the SMTP transporter verifies successfully', async () => {
    const verify = vi.fn().mockResolvedValue(true);

    const provider = new EmailProvider({
      providerName: 'mock-email',
      username: 'sender@example.com',
      transporter: {
        sendMail: vi.fn(),
        verify,
      } as never,
    });

    const health = await provider.healthCheck();

    expect(verify).toHaveBeenCalledOnce();
    expect(health).toMatchObject({
      provider: 'mock-email',
      healthy: true,
      message: 'Email SMTP connection is healthy',
    });
    expect(health.checkedAt).toBeTruthy();
  });

  it('reports the SMTP error when verification fails with an Error', async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new Error('SMTP connection refused'));

    const provider = new EmailProvider({
      providerName: 'mock-email',
      username: 'sender@example.com',
      transporter: {
        sendMail: vi.fn(),
        verify,
      } as never,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'mock-email',
      healthy: false,
      message: 'SMTP connection refused',
    });
  });

  it('uses a fallback health-check message for non-Error failures', async () => {
    const verify = vi.fn().mockRejectedValue('SMTP unavailable');

    const provider = new EmailProvider({
      providerName: 'mock-email',
      username: 'sender@example.com',
      transporter: {
        sendMail: vi.fn(),
        verify,
      } as never,
    });

    const health = await provider.healthCheck();

    expect(health).toMatchObject({
      provider: 'mock-email',
      healthy: false,
      message: 'Email SMTP health check failed',
    });
  });
});
