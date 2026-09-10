import type { EventPriority, EventType } from '../types/events.js';
import type { UserPreference } from '../enrichment/event-enricher.js';

export const channels = [
  'sms',
  'email',
  'push',
  'whatsapp',
  'in-app',
  'ivr',
  'webhook',
] as const;
export type Channel = (typeof channels)[number];

export interface RoutingDecision {
  channels: Channel[];
  reason: 'regulatory-override' | 'user-preference' | 'system-default';
}

const regulatoryOverrides: Record<string, Channel[]> = {
  'REGX-001': ['sms', 'email', 'push'],
  'REGX-002': ['email', 'push'],
  'REGX-003': ['email'],
  'REGX-004': ['email', 'in-app'],
  'REGX-005': ['email'],
};

const defaultsByPriority: Record<EventPriority, Channel[]> = {
  critical: ['sms', 'push'],
  high: ['push', 'email'],
  normal: ['email', 'in-app'],
  low: ['email'],
};

const categoryDefaults: Partial<Record<EventType, Channel[]>> = {
  'security.suspicious_activity': ['sms', 'push', 'in-app'],
  'user.password_reset_requested': ['email', 'sms', 'push'],
  'transaction.failed': ['push', 'email'],
  'payment.failed': ['push', 'email'],
  'subscription.payment_failed': ['push', 'email'],
  'promotion.available': ['email', 'push'],
  'promotion.expiring': ['email', 'push'],
};

export class EventRouter {
  route(
    eventType: string,
    priority: EventPriority,
    preferences: UserPreference[],
  ): RoutingDecision {
    const regulatory = regulatoryOverrides[eventType];
    if (regulatory)
      return { channels: regulatory, reason: 'regulatory-override' };

    const preferred = preferences
      .filter(
        (preference) =>
          preference.enabled &&
          (preference.eventTypes.length === 0 ||
            preference.eventTypes.includes(eventType)),
      )
      .map((preference) => preference.channel)
      .filter(
        (channel, index, values): channel is Channel =>
          channels.includes(channel) && values.indexOf(channel) === index,
      );

    if (preferred.length > 0)
      return { channels: preferred, reason: 'user-preference' };

    return {
      channels: (
        categoryDefaults[eventType as EventType] ?? defaultsByPriority[priority]
      ).filter((channel, index, values) => values.indexOf(channel) === index),
      reason: 'system-default',
    };
  }
}
