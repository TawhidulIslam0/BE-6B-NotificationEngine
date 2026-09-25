import {
  Kafka,
  logLevel,
  type Admin,
  type Consumer,
  type Producer,
} from 'kafkajs';
import { env } from '../../config/env.js';

/** Shared Kafka client configured for the notification event backbone. */
export const kafka = new Kafka({
  clientId: env.kafka.clientId,
  brokers: env.kafka.brokers,
  logLevel: logLevel.ERROR,
});

/** Creates a Kafka producer for publishing notification events. */
export function createProducer(): Producer {
  return kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
    allowAutoTopicCreation: false,
  });
}

/** Creates a Kafka consumer for the configured consumer group. */
export function createConsumer(groupId = env.kafka.groupId): Consumer {
  return kafka.consumer({ groupId, allowAutoTopicCreation: false });
}

/** Creates required event topics when they do not already exist. */
export async function ensureKafkaTopics(admin: Admin): Promise<void> {
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic: env.kafka.eventsTopic,
        numPartitions: env.kafka.partitions,
        replicationFactor: env.kafka.replicationFactor,
      },
      {
        topic: env.kafka.criticalTopic,
        numPartitions: env.kafka.partitions,
        replicationFactor: env.kafka.replicationFactor,
      },
      {
        topic: env.kafka.dlqTopic,
        numPartitions: env.kafka.partitions,
        replicationFactor: env.kafka.replicationFactor,
      },
    ],
  });
}
