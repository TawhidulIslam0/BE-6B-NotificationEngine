import { createHash } from 'node:crypto';
import type { EventEnvelope } from '../types/events.js';
import { redis } from '../../infrastructure/redis/redis-client.js';
import { env } from '../../config/env.js';

/** Builds the stable Redis key used to deduplicate an event. */
export function createIdempotencyKey(
  event: Pick<
    EventEnvelope,
    'event_type' | 'user_id' | 'occurred_at' | 'payload'
  >,
): string {
  const timestampWindow = Math.floor(
    new Date(event.occurred_at).getTime() / (5 * 60 * 1000),
  );
  const fingerprint = `${event.event_type}:${event.user_id}:${timestampWindow}:${JSON.stringify(event.payload)}`;
  return `notification:idempotency:${createHash('sha256').update(fingerprint).digest('hex')}`;
}

/** Prevents duplicate processing of the same event envelope. */
export class EventDeduplicator {
  async isDuplicate(event: EventEnvelope): Promise<boolean> {
    const result = await redis.set(
      createIdempotencyKey(event),
      '1',
      'EX',
      env.redis.idempotencyTtlSeconds,
      'NX',
    );
    return result === null;
  }
}
