import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({
  path: resolve(process.cwd(), '../.env'),
});

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  kafka: {
    brokers: required('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((value) => value.trim()),

    clientId: required('KAFKA_CLIENT_ID', 'notification-engine'),

    groupId: required('KAFKA_GROUP_ID', 'notification-engine-group'),

    eventsTopic: required('KAFKA_EVENTS_TOPIC', 'notification-events'),

    criticalTopic: required('KAFKA_CRITICAL_TOPIC', 'notification-critical'),

    dlqTopic: required('KAFKA_DLQ_TOPIC', 'notification-dlq'),

    partitions: Number(process.env.KAFKA_PARTITIONS ?? 3),

    replicationFactor: Number(process.env.KAFKA_REPLICATION_FACTOR ?? 1),

    consumerConcurrency: Number(process.env.KAFKA_CONSUMER_CONCURRENCY ?? 1),
  },

  redis: {
    host: required('REDIS_HOST', 'localhost'),

    port: Number(process.env.REDIS_PORT ?? 6379),

    password: process.env.REDIS_PASSWORD || undefined,

    idempotencyTtlSeconds: Number(
      process.env.REDIS_IDEMPOTENCY_TTL_SECONDS ?? 86400,
    ),
  },
};
