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
import type { PreferenceService } from '../../preferences/service.js';
import {
  DigestService,
  InMemoryDigestBatchStore,
} from '../../preferences/digest-service.js';
import type {
  PreferenceChannel,
  UserPreferences,
} from '../../preferences/types.js';
import type {
  DigestNotification,
  NotificationDigest,
} from '../../preferences/digest.js';

export interface ProcessedEvent extends EnrichedEvent {
  routing: RoutingDecision;
  duplicate: boolean;
  digestQueued?: boolean;
}

export interface ProcessedDigest {
  digest: NotificationDigest;
  userId: string;
  channel: PreferenceChannel;
  routing: RoutingDecision;
}

export type EventHandler = (result: ProcessedEvent) => Promise<void>;

export type DigestHandler = (result: ProcessedDigest) => Promise<void>;

export class NotificationConsumer {
  private readonly consumer: Consumer;
  private readonly digestService: DigestService;

  constructor(
    private readonly deduplicator = new EventDeduplicator(),
    private readonly enricher = new EventEnricher(),
    private readonly router = new EventRouter(),
    consumer = createConsumer(),
    private readonly preferenceService?: PreferenceService,
    digestService = new DigestService(new InMemoryDigestBatchStore()),
  ) {
    this.consumer = consumer;
    this.digestService = digestService;
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

          let routing: RoutingDecision;
          let preferences: UserPreferences | undefined;

          if (this.preferenceService) {
            preferences = await this.preferenceService.get(event.user_id);

            routing = this.router.route(
              event.event_type,
              event.priority,
              enriched.preferences,
            );
          } else {
            routing = this.router.route(
              event.event_type,
              event.priority,
              enriched.preferences,
            );
          }

          const digestChannels =
            preferences === undefined
              ? []
              : this.getDigestChannels(preferences);

          const shouldQueueDigest =
            event.priority === 'low' && digestChannels.length > 0;

          if (shouldQueueDigest) {
            for (const channel of digestChannels) {
              const digestNotification: DigestNotification = {
                id: event.event_id,
                userId: event.user_id,
                channel,
                title: this.getDigestTitle(event),
                body: this.getDigestBody(event),
                priority: event.priority,
                createdAt: event.occurred_at,
              };

              await this.digestService.add(digestNotification);
            }

            await handler({
              ...enriched,
              routing: {
                channels: [],
                reason: 'user-preference',
              },
              duplicate: false,
              digestQueued: true,
            });
          } else {
            await handler({
              ...enriched,
              routing,
              duplicate: false,
              digestQueued: false,
            });
          }
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

  async flushDigest(
    userId: string,
    channel: PreferenceChannel,
    handler: DigestHandler,
  ): Promise<boolean> {
    const digest = await this.digestService.flush(userId, channel);

    if (!digest) {
      return false;
    }

    await handler({
      digest,
      userId,
      channel,
      routing: {
        channels: [channel],
        reason: 'user-preference',
      },
    });

    return true;
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  private getDigestChannels(preferences: UserPreferences): PreferenceChannel[] {
    return Object.entries(preferences.channels)
      .filter(
        ([, preference]) => preference.enabled && preference.mode === 'digest',
      )
      .map(([channel]) => channel as PreferenceChannel);
  }

  private getDigestTitle(event: ReturnType<typeof deserializeEvent>): string {
    return `Notification digest: ${event.event_type}`;
  }

  private getDigestBody(event: ReturnType<typeof deserializeEvent>): string {
    return JSON.stringify(event.payload);
  }
}
