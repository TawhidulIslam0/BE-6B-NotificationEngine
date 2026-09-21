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

import { logger } from './logging/logger.js';

const port = Number(process.env.PORT ?? 3000);

let shuttingDown = false;

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

const socketNotificationServer = new SocketNotificationServer(
  httpServer,
);

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

const retryScheduler = new RetryScheduler(
  redis,
  retryPolicyService,
);

const dlqDashboardRepository = new DlqDashboardRepository(
  database,
);

const dlqConsumer = new DlqConsumer(
  dlqDashboardRepository,
  retryScheduler,
);

const dlqDashboardService = new DlqDashboardService(
  dlqDashboardRepository,
  dlqConsumer,
);

const analyticsRepository = new PostgresAnalyticsRepository(
  database,
);

const analyticsApi = new AnalyticsApi(
  analyticsRepository,
);

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

    readinessChecks: {
      database: async () => {
        try {
          await database.raw('SELECT 1');
          return true;
        } catch {
          return false;
        }
      },

      redis: async () => {
        try {
          await redis.ping();
          return true;
        } catch {
          return false;
        }
      },

      kafka: async () => {
        try {
          return await notificationProducer.healthCheck();
        } catch {
          return false;
        }
      },

      rabbitmq: async () => true,
    },
  });

  httpServer.on(
    'request',
    application,
  );

  httpServer.listen(
    port,
    () => {
      logger.info(
        {
          port,
        },
        'Notification Engine backend started',
      );

      logger.info(
        {
          provider:
            inAppProvider.constructor.name,
        },
        'In-app provider initialized',
      );

      logger.info(
        {},
        'DLQ dashboard initialized',
      );

      logger.info(
        {},
        'Retry scheduler initialized',
      );

      logger.info(
        {},
        'Analytics API initialized',
      );

      logger.info(
        {
          endpoint: '/metrics',
        },
        'Prometheus metrics initialized',
      );

      logger.info(
        {},
        'Kafka producer initialized',
      );

      logger.info(
        {},
        'Kafka consumer initialized',
      );
    },
  );

  void notificationConsumer.run(
    async (result) => {
      logger.info(
        {
          correlationId:
            result.event.correlation_id,
          eventId:
            result.event.event_id,
          eventType:
            result.event.event_type,
          userId:
            result.event.user_id,
          priority:
            result.event.priority,
          duplicate:
            result.duplicate,
          digestQueued:
            result.digestQueued ?? false,
          routing:
            result.routing,
        },
        'Notification event processed',
      );
    },
  );
};

const shutdown = async (
  signal: string,
): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.warn(
    {
      signal,
    },
    'Graceful shutdown started',
  );

  const timeout = setTimeout(
    () => {
      logger.error(
        {},
        'Shutdown timeout exceeded',
      );

      process.exit(1);
    },
    15000,
  );

  try {
    httpServer.close();

    await notificationConsumer.disconnect();

    await notificationProducer.disconnect();

    await socketNotificationServer.close();

    await redis.quit();

    await database.destroy();

    clearTimeout(timeout);

    logger.info(
      {},
      'Graceful shutdown completed',
    );

    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);

    logger.error(
      {
        error,
      },
      'Graceful shutdown failed',
    );

    process.exit(1);
  }
};

process.on(
  'SIGINT',
  () => {
    void shutdown('SIGINT');
  },
);

process.on(
  'SIGTERM',
  () => {
    void shutdown('SIGTERM');
  },
);

void start().catch(
  (error: unknown) => {
    logger.error(
      {
        error,
      },
      'Notification Engine failed to start',
    );

    process.exitCode = 1;
  },
);