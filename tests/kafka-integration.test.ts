import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { kafka } from '../src/infrastructure/kafka/kafka-client.js';
import { env } from '../src/config/env.js';
import { createEvent } from '../src/events/factory/event-factory.js';
import {
  deserializeEvent,
  serializeEvent,
} from '../src/events/serialization/event-serializer.js';
import { EventRouter } from '../src/events/routing/event-router.js';

const runIntegration = process.env.RUN_KAFKA_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('Kafka ingestion integration', () => {
  const producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
    allowAutoTopicCreation: false,
  });

  const consumer = kafka.consumer({
    groupId: `notification-engine-it-${randomUUID()}`,
    allowAutoTopicCreation: false,
  });

  const router = new EventRouter();

  beforeAll(async () => {
    await producer.connect();
    await consumer.connect();

    await consumer.subscribe({
      topic: env.kafka.eventsTopic,
      fromBeginning: false,
    });
  }, 15000);

  afterAll(async () => {
    await consumer.disconnect();
    await producer.disconnect();
  }, 15000);

  it('produces, consumes, deserializes, and routes an event', async () => {
    const userId = '00000000-0000-0000-0000-000000000001';

    const event = createEvent(
      'transaction.failed',
      {
        transactionId: `it-${randomUUID()}`,
        amount: 42,
        currency: 'USD',
        reason: 'integration-test',
      },
      {
        userId,
        source: 'kafka-integration-test',
      },
    );

    const serialized = serializeEvent(event);

    const received = await new Promise<ReturnType<typeof deserializeEvent>>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timed out waiting for Kafka event'));
        }, 30000);

        void consumer
          .run({
            autoCommit: false,

            eachMessage: async ({ message, partition }) => {
              try {
                const decoded = deserializeEvent(
                  message.value ?? Buffer.from(''),
                );

                const routing = router.route(
                  decoded.event_type,
                  decoded.priority,
                  [],
                );

                await consumer.commitOffsets([
                  {
                    topic: env.kafka.eventsTopic,
                    partition,
                    offset: (BigInt(message.offset) + 1n).toString(),
                  },
                ]);

                expect(decoded.event_type).toBe('transaction.failed');
                expect(decoded.user_id).toBe(userId);
                expect(routing.channels).toEqual(['push', 'email']);
                expect(routing.reason).toBe('system-default');

                clearTimeout(timer);
                resolve(decoded);
              } catch (error) {
                clearTimeout(timer);
                reject(error);
              }
            },
          })
          .catch((error: unknown) => {
            clearTimeout(timer);
            reject(error);
          });

        setTimeout(() => {
          void producer
            .send({
              topic: env.kafka.eventsTopic,
              acks: -1,
              messages: [
                {
                  key: userId,
                  value: serialized.value,
                  headers: serialized.headers,
                },
              ],
            })
            .catch((error: unknown) => {
              clearTimeout(timer);
              reject(error);
            });
        }, 3000);
      },
    );

    expect(received.event_type).toBe('transaction.failed');
    expect(received.user_id).toBe(userId);
  }, 45000);
});
