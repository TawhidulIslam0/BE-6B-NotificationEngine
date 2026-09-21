import { createServer } from 'node:http';

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

import { NotificationProducer } from './events/producer/notification-producer.js';
import { NotificationConsumer } from './events/consumer/notification-consumer.js';

import { database } from './infrastructure/postgres/client.js';
import { redis } from './infrastructure/redis/redis-client.js';
import { SocketNotificationServer } from './infrastructure/socket/socket-server.js';

import {
  AnalyticsApi,
  PostgresAnalyticsRepository,
  PrometheusMetricsService,
  RedisAnalyticsService,
} from './analytics/index.js';

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

const redisAnalyticsService = new RedisAnalyticsService(redis);

const retryPolicyService = new RetryPolicyService();
const retryScheduler = new RetryScheduler(redis, retryPolicyService);

const dlqDashboardRepository = new DlqDashboardRepository(database);

const dlqConsumer = new DlqConsumer(dlqDashboardRepository, retryScheduler);

const dlqDashboardService = new DlqDashboardService(
  dlqDashboardRepository,
  dlqConsumer,
);

const analyticsRepository = new PostgresAnalyticsRepository(database);
const analyticsApi = new AnalyticsApi(analyticsRepository);

const prometheusMetricsService = new PrometheusMetricsService(
  redisAnalyticsService,
);

const notificationProducer = new NotificationProducer();
const notificationConsumer = new NotificationConsumer();

const start = async (): Promise<void> => {
  await notificationProducer.connect();
  await notificationConsumer.connect();

  const application = createApp({
    providerHealthService,
    dlqDashboardService,
    analyticsApi,
    prometheusMetricsService,
    notificationProducer,
  });

  httpServer.on('request', application);

  httpServer.listen(port, () => {
    console.log(`Notification Engine backend is running on port ${port}`);
    console.log('Socket.io notification server is running');
    console.log(
      `In-app provider initialized: ${inAppProvider.constructor.name}`,
    );
    console.log('DLQ dashboard API initialized');
    console.log('Retry scheduler initialized');
    console.log('DLQ consumer initialized');
    console.log('Analytics API initialized');
    console.log('Prometheus metrics endpoint initialized at /metrics');
    console.log('Notification Kafka producer initialized');
    console.log('Notification Kafka consumer initialized');
  });

  void notificationConsumer.run(async (result) => {
    console.log(
      JSON.stringify({
        eventId: result.event.event_id,
        eventType: result.event.event_type,
        userId: result.event.user_id,
        priority: result.event.priority,
        duplicate: result.duplicate,
        digestQueued: result.digestQueued ?? false,
        routing: result.routing,
      }),
    );
  });
};

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully...`);

  await notificationConsumer.disconnect();
  await notificationProducer.disconnect();
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

void start().catch((error: unknown) => {
  console.error('Notification Engine failed to start:', error);
  process.exitCode = 1;
});
