import { createServer } from 'node:http';

import Redis from 'ioredis';

export * from './delivery/health/provider-health-service.js';

import { createApp } from './app.js';

import {
  EmailProvider,
  InAppProvider,
  ProviderHealthService,
  PushProvider,
  WhatsAppProvider,
} from './delivery/index.js';

import { SmsProvider } from './delivery/providers/sms-provider.js';

import { DlqConsumer } from './delivery/dlq/dlq-consumer.js';

import { DlqDashboardRepository } from './delivery/dlq/dlq-dashboard-repository.js';

import { DlqDashboardService } from './delivery/dlq/dlq-dashboard-service.js';

import { RetryPolicyService } from './delivery/retry/retry-policy.js';

import { RetryScheduler } from './delivery/retry/retry-scheduler.js';

import { SocketNotificationServer } from './infrastructure/socket/socket-server.js';

import { database } from './infrastructure/postgres/client.js';

const port = Number(process.env.PORT ?? 3000);

const emailProvider = new EmailProvider({
  testMode: true,
  providerName: 'email-test-provider',
});

const smsProvider = new SmsProvider({
  testMode: true,
  providerName: 'sms-test-provider',
});

const pushProvider = new PushProvider({
  testMode: true,
  providerName: 'fcm-test-provider',
});

const whatsappProvider = new WhatsAppProvider({
  testMode: true,
  providerName: 'whatsapp-test-provider',
});

const httpServer = createServer();

const socketNotificationServer = new SocketNotificationServer(httpServer);

const inAppProvider = new InAppProvider({
  providerName: 'socket-io-in-app',
  socketNotificationServer,
});

const providerHealthService = new ProviderHealthService([
  emailProvider,
  smsProvider,
  pushProvider,
  whatsappProvider,
  inAppProvider,
]);

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
});

const retryPolicyService = new RetryPolicyService();

const retryScheduler = new RetryScheduler(redis, retryPolicyService);

const dlqDashboardRepository = new DlqDashboardRepository(database);

const dlqConsumer = new DlqConsumer(dlqDashboardRepository, retryScheduler);

const dlqDashboardService = new DlqDashboardService(
  dlqDashboardRepository,
  dlqConsumer,
);

const application = createApp({
  providerHealthService,
  dlqDashboardService,
});

httpServer.on('request', application);

httpServer.listen(port, () => {
  console.log(`Notification Engine backend is running on port ${port}`);

  console.log('Socket.io notification server is running');

  console.log(`In-app provider initialized: ${inAppProvider.constructor.name}`);

  console.log('DLQ dashboard API initialized');

  console.log('Retry scheduler initialized');

  console.log('DLQ consumer initialized');
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully...`);

  await socketNotificationServer.close();

  await redis.quit();

  await database.destroy();

  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
