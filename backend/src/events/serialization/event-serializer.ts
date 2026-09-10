import { validateEvent } from '../factory/event-factory.js';
import type { EventEnvelope } from '../types/events.js';

export const EVENT_SCHEMA_VERSION = '1.0';

export interface SerializedEvent {
  value: Buffer;
  headers: Record<string, string>;
}

export function serializeEvent(event: EventEnvelope): SerializedEvent {
  const validated = validateEvent(event);
  return {
    value: Buffer.from(JSON.stringify(validated), 'utf8'),
    headers: {
      'content-type': 'application/json',
      'schema-version': EVENT_SCHEMA_VERSION,
      'event-type': validated.event_type,
    },
  };
}

export function deserializeEvent(value: Buffer | string): EventEnvelope {
  return validateEvent(
    JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : value),
  );
}
