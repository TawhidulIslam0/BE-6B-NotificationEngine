import { afterEach, describe, expect, it } from 'vitest';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { Readable } from 'node:stream';
import { SMTPServer } from 'smtp-server';
import nodemailer from 'nodemailer';
import { io as createSocketClient } from 'socket.io-client';

import { EmailProvider } from '../../src/delivery/providers/email-provider.js';
import { InAppProvider } from '../../src/delivery/providers/in-app-provider.js';
import { PushProvider } from '../../src/delivery/providers/push-provider.js';
import { SmsProvider } from '../../src/delivery/providers/sms-provider.js';
import { WhatsAppProvider } from '../../src/delivery/providers/whatsapp-provider.js';
import type { PreparedNotification } from '../../src/delivery/providers/types.js';
import {
  SocketNotificationServer,
  type SocketNotificationPayload,
} from '../../src/infrastructure/socket/socket-server.js';

interface MockServer {
  server: Server;
  url: string;
  requests: Array<{
    method?: string;
    url?: string;
    body: unknown;
    headers: IncomingMessage['headers'];
  }>;
  close: () => Promise<void>;
}

interface MockSmtpServer {
  server: SMTPServer;
  port: number;
  messages: string[];
  close: () => Promise<void>;
}

const notification = (
  channel: PreparedNotification['channel'],
): PreparedNotification => ({
  id: `notification-${channel}-001`,
  userId: 'user-001',
  channel,
  recipient: channel === 'push' ? 'fcm-device-token-001' : '+14155550123',
  subject: 'Test notification',
  body: 'This is a provider integration test.',
});

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString('utf8');

  return text.length === 0 ? undefined : JSON.parse(text);
};

const createMockServer = async (
  handler: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>,
): Promise<MockServer> => {
  const requests: MockServer['requests'] = [];

  const server = createServer(async (request, response) => {
    const body = await readBody(request);

    requests.push({
      method: request.method,
      url: request.url,
      body,
      headers: request.headers,
    });

    await handler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Mock server did not expose a TCP address');
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      if (!server.listening) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
};

const createMockSmtpServer = async (): Promise<MockSmtpServer> => {
  const messages: string[] = [];

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    onData(
      stream: Readable,
      _session: unknown,
      callback: (error?: Error | null) => void,
    ) {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });

      stream.on('end', () => {
        messages.push(Buffer.concat(chunks).toString('utf8'));
        callback();
      });

      stream.on('error', callback);
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('SMTP server did not expose a TCP address');
  }

  return {
    server,
    port: address.port,
    messages,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
};

const respondJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
};

describe('delivery provider integrations', () => {
  const servers: MockServer[] = [];
  const smtpServers: MockSmtpServer[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(async (mockServer) => {
        await mockServer.close();
      }),
    );

    await Promise.all(
      smtpServers.splice(0).map(async (smtpServer) => {
        await smtpServer.close();
      }),
    );
  });

  it('sends SMS requests to a mock HTTP server', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 200, {
        messageId: 'sms-message-001',
        status: 'accepted',
      });
    });

    servers.push(mockServer);

    const provider = new SmsProvider({
      apiUrl: mockServer.url,
      apiKey: 'sms-test-key',
      providerName: 'mock-sms',
    });

    const receipt = await provider.send(notification('sms'));

    expect(receipt).toMatchObject({
      externalId: 'sms-message-001',
      status: 'accepted',
      provider: 'mock-sms',
    });

    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0]).toMatchObject({
      method: 'POST',
      url: '/',
      body: {
        to: '+14155550123',
        message: 'This is a provider integration test.',
      },
    });

    expect(mockServer.requests[0].headers.authorization).toBe(
      'Bearer sms-test-key',
    );
  });

  it('parses SMS provider failure responses', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 429, {
        error: 'SMS_RATE_LIMIT',
      });
    });

    servers.push(mockServer);

    const provider = new SmsProvider({
      apiUrl: mockServer.url,
      providerName: 'mock-sms',
    });

    await expect(provider.send(notification('sms'))).rejects.toThrow(
      'SMS_RATE_LIMIT',
    );
  });

  it('sends FCM HTTP v1 requests to a mock HTTP server', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 200, {
        name: 'projects/mock-project/messages/fcm-message-001',
      });
    });

    servers.push(mockServer);

    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      providerName: 'mock-fcm',
      fetcher: async (input, init) => {
        const requestUrl = new URL(String(input));

        return fetch(`${mockServer.url}${requestUrl.pathname}`, init);
      },
    });

    const receipt = await provider.send(notification('push'));

    expect(receipt).toMatchObject({
      externalId: 'projects/mock-project/messages/fcm-message-001',
      status: 'accepted',
      provider: 'mock-fcm',
    });

    expect(mockServer.requests[0]).toMatchObject({
      method: 'POST',
      url: '/v1/projects/mock-project/messages:send',
      body: {
        message: {
          token: 'fcm-device-token-001',
          notification: {
            title: 'Test notification',
            body: 'This is a provider integration test.',
          },
        },
      },
    });
  });

  it('parses FCM failure responses', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 400, {
        error: {
          message: 'FCM_INVALID_ARGUMENT',
        },
      });
    });

    servers.push(mockServer);

    const provider = new PushProvider({
      projectId: 'mock-project',
      accessToken: 'fcm-test-token',
      providerName: 'mock-fcm',
      fetcher: async (input, init) => {
        const requestUrl = new URL(String(input));

        return fetch(`${mockServer.url}${requestUrl.pathname}`, init);
      },
    });

    await expect(provider.send(notification('push'))).rejects.toThrow(
      'FCM_INVALID_ARGUMENT',
    );
  });

  it('sends WhatsApp requests to a mock HTTP server', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 200, {
        messages: [{ id: 'whatsapp-message-001' }],
      });
    });

    servers.push(mockServer);

    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      providerName: 'mock-whatsapp',
      fetcher: async (input, init) => {
        const requestUrl = new URL(String(input));

        return fetch(`${mockServer.url}${requestUrl.pathname}`, init);
      },
    });

    const receipt = await provider.send(notification('whatsapp'));

    expect(receipt).toMatchObject({
      externalId: 'whatsapp-message-001',
      status: 'accepted',
      provider: 'mock-whatsapp',
    });

    expect(mockServer.requests[0]).toMatchObject({
      method: 'POST',
      url: '/v20.0/mock-phone-number-id/messages',
      body: {
        messaging_product: 'whatsapp',
        to: '+14155550123',
        type: 'text',
        text: {
          body: 'This is a provider integration test.',
        },
      },
    });
  });

  it('parses WhatsApp failure responses', async () => {
    const mockServer = await createMockServer(async (_request, response) => {
      respondJson(response, 401, {
        error: {
          message: 'WHATSAPP_INVALID_TOKEN',
        },
      });
    });

    servers.push(mockServer);

    const provider = new WhatsAppProvider({
      phoneNumberId: 'mock-phone-number-id',
      accessToken: 'whatsapp-test-token',
      providerName: 'mock-whatsapp',
      fetcher: async (input, init) => {
        const requestUrl = new URL(String(input));

        return fetch(`${mockServer.url}${requestUrl.pathname}`, init);
      },
    });

    await expect(provider.send(notification('whatsapp'))).rejects.toThrow(
      'WHATSAPP_INVALID_TOKEN',
    );
  });

  it('sends email through a real mock SMTP server', async () => {
    const smtp = await createMockSmtpServer();
    smtpServers.push(smtp);

    const transporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      ignoreTLS: true,
    });

    const provider = new EmailProvider({
      providerName: 'mock-smtp',
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      username: 'sender@example.com',
      password: 'smtp-test-password',
      transporter,
    });

    const receipt = await provider.send({
      id: 'notification-email-smtp-001',
      userId: 'user-001',
      channel: 'email',
      recipient: 'recipient@example.com',
      subject: 'SMTP integration test',
      body: 'This message was sent through a real mock SMTP server.',
    });

    expect(receipt.status).toBe('accepted');
    expect(receipt.provider).toBe('mock-smtp');
    expect(receipt.externalId).toBeTruthy();

    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0]).toContain('Subject: SMTP integration test');
    expect(smtp.messages[0]).toContain(
      'This message was sent through a real mock SMTP server.',
    );
    expect(smtp.messages[0]).toContain('From: sender@example.com');
    expect(smtp.messages[0]).toContain('To: recipient@example.com');
  });

  it('sends in-app notifications through a real Socket.io server', async () => {
    const httpServer = createServer();
    const socketNotificationServer = new SocketNotificationServer(httpServer);

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Socket.io server did not expose a TCP address');
    }

    const socketUrl = `http://127.0.0.1:${address.port}`;

    const receivedNotifications: SocketNotificationPayload[] = [];

    const clientSocket = createSocketClient(socketUrl, {
      transports: ['websocket'],
    });

    const provider = new InAppProvider({
      providerName: 'mock-socket-io',
      socketNotificationServer,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket.io client connection timed out'));
        }, 3000);

        clientSocket.once('connect', () => {
          clearTimeout(timeout);
          clientSocket.emit('register-user', 'user-001');
          resolve();
        });

        clientSocket.once('connect_error', reject);
      });

      clientSocket.on('notification', (payload: SocketNotificationPayload) => {
        receivedNotifications.push(payload);
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      const receipt = await provider.send({
        id: 'notification-in-app-001',
        userId: 'user-001',
        channel: 'in-app',
        recipient: 'user-001',
        subject: 'Socket.io integration test',
        body: 'This is a Socket.io integration test.',
      });

      expect(receipt).toMatchObject({
        externalId: 'in-app-notification-in-app-001',
        status: 'accepted',
        provider: 'mock-socket-io',
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(receivedNotifications).toHaveLength(1);
      expect(receivedNotifications[0]).toMatchObject({
        recipient: 'user-001',
        notification: {
          id: 'notification-in-app-001',
          channel: 'in-app',
          body: 'This is a Socket.io integration test.',
        },
      });
    } finally {
      provider.disconnect();
      clientSocket.disconnect();
      await socketNotificationServer.close();

      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error?: Error) => {
            if (error !== undefined) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }
    }
  });
});
