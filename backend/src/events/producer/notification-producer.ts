import type { Producer } from 'kafkajs';
import { env } from '../../config/env.js';
import { createProducer } from '../../infrastructure/kafka/kafka-client.js';
import { serializeEvent } from '../serialization/event-serializer.js';
import type { EventEnvelope } from '../types/events.js';

export class NotificationProducer {
  private readonly producer: Producer;
  constructor(producer = createProducer()) {
    this.producer = producer;
  }
  async connect(): Promise<void> {
    await this.producer.connect();
  }
  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
  async publish(event: EventEnvelope): Promise<void> {
    const topic =
      event.priority === 'critical'
        ? env.kafka.criticalTopic
        : env.kafka.eventsTopic;
    const serialized = serializeEvent(event);
    await this.producer.send({
      topic,
      acks: -1,
      messages: [
        {
          key: event.user_id,
          value: serialized.value,
          headers: serialized.headers,
        },
      ],
    });
  }
}
