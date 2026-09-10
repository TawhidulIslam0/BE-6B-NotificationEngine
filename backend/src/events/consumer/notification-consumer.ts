import type { Consumer, EachMessagePayload } from 'kafkajs';
import { env } from '../../config/env.js';
import { createConsumer } from '../../infrastructure/kafka/kafka-client.js';
import { EventDeduplicator } from '../deduplication/event-deduplicator.js';
import {
  EventEnricher,
  type EnrichedEvent,
} from '../enrichment/event-enricher.js';
import { deserializeEvent } from '../serialization/event-serializer.js';
import { EventRouter, type RoutingDecision } from '../routing/event-router.js';

export interface ProcessedEvent extends EnrichedEvent {
  routing: RoutingDecision;
  duplicate: boolean;
}
export type EventHandler = (result: ProcessedEvent) => Promise<void>;

export class NotificationConsumer {
  private readonly consumer: Consumer;
  constructor(
    private readonly deduplicator = new EventDeduplicator(),
    private readonly enricher = new EventEnricher(),
    private readonly router = new EventRouter(),
    consumer = createConsumer(),
  ) {
    this.consumer = consumer;
  }
  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: env.kafka.eventsTopic,
      fromBeginning: false,
    });
    await this.consumer.subscribe({
      topic: env.kafka.criticalTopic,
      fromBeginning: false,
    });
  }
  async run(handler: EventHandler): Promise<void> {
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload) => {
        const event = deserializeEvent(
          payload.message.value ?? Buffer.from(''),
        );
        const duplicate = await this.deduplicator.isDuplicate(event);
        if (!duplicate) {
          const enriched = await this.enricher.enrich(event);
          const routing = this.router.route(
            event.event_type,
            event.priority,
            enriched.preferences,
          );
          await handler({ ...enriched, routing, duplicate: false });
        }
        await this.consumer.commitOffsets([
          {
            topic: payload.topic,
            partition: payload.partition,
            offset: (BigInt(payload.message.offset) + 1n).toString(),
          },
        ]);
      },
    });
  }
  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
