import { randomUUID } from 'node:crypto';

import Redis from 'ioredis';

import { database } from '../src/infrastructure/postgres/client.js';
import { RedisAnalyticsService } from '../src/analytics/redis-analytics-service.js';

const CHANNELS = ['email', 'sms', 'push', 'whatsapp', 'in_app'] as const;

const EVENT_TYPES = [
  'user.registered',
  'user.welcome',
  'user.email_verified',
  'user.phone_verified',
  'user.password_changed',
  'user.password_reset_requested',
  'user.login_new_device',
  'user.account_locked',
] as const;

const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

const TOTAL_NOTIFICATIONS = 100;

const randomItem = <T>(items: readonly T[]): T => {
  return items[Math.floor(Math.random() * items.length)]!;
};

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomFloat = (min: number, max: number): number => {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
};

const randomDateWithinLastSevenDays = (): Date => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return new Date(now - Math.floor(Math.random() * sevenDaysMs));
};

const getFailureReason = (): string => {
  return randomItem([
    'provider_timeout',
    'provider_unavailable',
    'rate_limit',
    'connection_reset',
  ]);
};

const getLatency = (channel: string): number => {
  switch (channel) {
    case 'email':
      return randomInt(250, 2500);

    case 'sms':
      return randomInt(150, 1800);

    case 'push':
      return randomInt(80, 900);

    case 'whatsapp':
      return randomInt(200, 2200);

    case 'in_app':
      return randomInt(20, 400);

    default:
      return randomInt(100, 2000);
  }
};

const getCost = (channel: string): number => {
  switch (channel) {
    case 'email':
      return randomFloat(0.001, 0.02);

    case 'sms':
      return randomFloat(0.01, 0.08);

    case 'push':
      return randomFloat(0.0001, 0.005);

    case 'whatsapp':
      return randomFloat(0.02, 0.12);

    case 'in_app':
      return randomFloat(0.0001, 0.002);

    default:
      return 0;
  }
};

const main = async (): Promise<void> => {
  console.log('Starting analytics mock-data generation...');

  const users = await database('users').select('id').limit(100);

  if (users.length === 0) {
    throw new Error(
      'No users found. Run the user seed before generating analytics data.',
    );
  }

  console.log(`Using ${users.length} users.`);

  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  });

  const analyticsService = new RedisAnalyticsService(redis);

  let deliveredCount = 0;
  let failedCount = 0;
  let optOutCount = 0;

  try {
    for (let index = 0; index < TOTAL_NOTIFICATIONS; index += 1) {
      const user = randomItem(users);
      const channel = randomItem(CHANNELS);
      const eventType = randomItem(EVENT_TYPES);
      const priority = randomItem(PRIORITIES);

      const createdAt = randomDateWithinLastSevenDays();
      const notificationId = randomUUID();
      const eventId = randomUUID();

      const delivered = Math.random() < 0.85;
      const latencyMs = getLatency(channel);
      const cost = getCost(channel);

      const finalState = delivered ? 'delivered' : 'failed';

      await database('notifications').insert({
        id: notificationId,
        event_id: eventId,
        event_type: eventType,
        user_id: user.id,
        priority,
        payload: JSON.stringify({
          simulation: true,
          eventType,
          channel,
          index,
        }),
        status: finalState,
        created_at: createdAt,
        updated_at: createdAt,
      });

      await database('notification_state_log').insert([
        {
          notification_id: notificationId,
          notification_created_at: createdAt,
          from_state: null,
          to_state: 'queued',
          metadata: {
            channel,
            simulation: true,
          },
          created_at: createdAt,
        },
        {
          notification_id: notificationId,
          notification_created_at: createdAt,
          from_state: 'queued',
          to_state: finalState,
          metadata: delivered
            ? {
                channel,
                latencyMs,
                cost,
                currency: 'USD',
                provider: `${channel}-simulation-provider`,
                simulation: true,
              }
            : {
                channel,
                latencyMs,
                cost,
                currency: 'USD',
                provider: `${channel}-simulation-provider`,
                failureReason: getFailureReason(),
                simulation: true,
              },
          created_at: new Date(createdAt.getTime() + latencyMs),
        },
      ]);

      await analyticsService.record({
        channel,
        status: finalState,
        latencyMs,
        timestamp: new Date(createdAt.getTime() + latencyMs),
      });

      if (delivered) {
        deliveredCount += 1;
      } else {
        failedCount += 1;
      }
    }

    const optOutUsers = users.slice(0, Math.min(25, users.length));

    for (const user of optOutUsers) {
      const channel = randomItem(CHANNELS);

      await database('consent_records').insert({
        user_id: user.id,
        channel,
        purpose: `analytics-simulation-${Date.now()}-${optOutCount}`,
        granted: false,
        recorded_at: randomDateWithinLastSevenDays(),
      });

      optOutCount += 1;
    }

    console.log('');
    console.log('Analytics mock data generated successfully.');
    console.log(`Notifications: ${TOTAL_NOTIFICATIONS}`);
    console.log(`Delivered: ${deliveredCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Opt-outs: ${optOutCount}`);
    console.log('');
    console.log('Redis analytics counters populated.');
    console.log('PostgreSQL analytics data populated.');
  } finally {
    await redis.quit();
    await database.destroy();
  }
};

void main().catch((error: unknown) => {
  console.error('Analytics mock-data generation failed:', error);
  process.exitCode = 1;
});
