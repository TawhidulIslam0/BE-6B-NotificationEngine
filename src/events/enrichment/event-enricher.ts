import type { EventEnvelope } from '../types/events.js';
import { database } from '../../infrastructure/postgres/client.js';
import type { Channel } from '../routing/event-router.js';

/** User data loaded to enrich an incoming event. */
export interface UserContext {
  userId: string;
  email: string;
  phone: string | null;
  timezone: string;
  isActive: boolean;
}

export interface UserPreference {
  channel: Channel;
  enabled: boolean;
  eventTypes: string[];
}

export interface EnrichedEvent {
  event: EventEnvelope;
  user: UserContext;
  preferences: UserPreference[];
}

/** Adds user and preference context to validated events. */
export class EventEnricher {
  async enrich(event: EventEnvelope): Promise<EnrichedEvent> {
    const user = await database('users')
      .select(
        'id as userId',
        'email',
        'phone',
        'timezone',
        'is_active as isActive',
      )
      .where('id', event.user_id)
      .first<UserContext>();

    if (!user) {
      throw new Error(`User not found: ${event.user_id}`);
    }

    if (!user.isActive) {
      throw new Error(`User is inactive: ${event.user_id}`);
    }

    const rows = await database('user_preferences')
      .select('channel', 'enabled', 'event_types')
      .where('user_id', event.user_id);

    const preferences: UserPreference[] = rows.map(
      (row: { channel: string; enabled: boolean; event_types: unknown }) => ({
        channel: row.channel as Channel,
        enabled: row.enabled,
        eventTypes: Array.isArray(row.event_types)
          ? row.event_types.map(String)
          : [],
      }),
    );

    return {
      event,
      user,
      preferences,
    };
  }
}
