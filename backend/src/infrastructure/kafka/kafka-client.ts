import {
  Kafka,
  logLevel,
  type Admin,
  type Consumer,
  type Producer,
} from 'kafkajs';
import { env } from '../../config/env.js';

export const kafka = new Kafka({
  clientId: env.kafka.clientId,
  brokers: env.kafka.brokers,
  logLevel: logLevel.ERROR,
});

export function createProducer(): Producer {
  return kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
    allowAutoTopicCreation: false,
  });
}

export function createConsumer(groupId = env.kafka.groupId): Consumer {
  return kafka.consumer({ groupId, allowAutoTopicCreation: false });
}

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
