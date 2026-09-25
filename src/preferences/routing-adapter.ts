import type { EventEnvelope } from '../events/types/events.js';
import type { UserPreference } from '../events/enrichment/event-enricher.js';
import {
  EventRouter,
  type RoutingDecision,
} from '../events/routing/event-router.js';
import type { PreferenceChannel, UserPreferences } from './types.js';

function toRoutingPreferences(preferences: UserPreferences): UserPreference[] {
  return Object.entries(preferences.channels)
    .filter(
      ([, channelPreference]) =>
        channelPreference.enabled && channelPreference.mode === 'immediate',
    )
    .map(([channel]) => {
      const eventTypes = Object.entries(preferences.categories)
        .filter(([, isEnabled]) => isEnabled)
        .map(([eventType]) => eventType);

      return {
        channel: channel as PreferenceChannel,
        enabled: true,
        eventTypes,
      };
    });
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
}

function currentMinutesInTimezone(timezone: string, now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(now);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);

  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0,
  );

  return hour * 60 + minute;
}

export function isWithinQuietHours(
  preferences: UserPreferences,
  now = new Date(),
): boolean {
  const quietHours = preferences.quietHours;

  if (!quietHours?.enabled) {
    return false;
  }

  const current = currentMinutesInTimezone(preferences.timezone, now);

  const start = minutesFromTime(quietHours.start);
  const end = minutesFromTime(quietHours.end);

  if (start === end) {
    return true;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  // Overnight range, for example 22:00–07:00.
  return current >= start || current < end;
}

export class PreferenceRoutingAdapter {
  constructor(
    private readonly router = new EventRouter(),
    private readonly now = () => new Date(),
  ) {}

  route(event: EventEnvelope, preferences: UserPreferences): RoutingDecision {
    const quietHoursActive = isWithinQuietHours(preferences, this.now());

    // Critical notifications bypass quiet hours.
    if (quietHoursActive && event.priority !== 'critical') {
      return {
        channels: [],
        reason: 'user-preference',
      };
    }

    return this.router.route(
      event.event_type,
      event.priority,
      toRoutingPreferences(preferences),
    );
  }
}
