import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eventTypes, type EventEnvelope, type EventPayloadMap, type EventPriority, type EventType } from '../types/events.js';
import { payloadSchemas } from '../schemas/event-schemas.js';

const priorityByEventType: Record<EventType, EventPriority> = {
  'user.registered': 'normal', 'user.welcome': 'normal', 'user.email_verified': 'normal', 'user.phone_verified': 'normal',
  'user.password_changed': 'high', 'user.password_reset_requested': 'critical', 'user.login_new_device': 'high',
  'user.account_locked': 'critical', 'user.account_unlocked': 'high', 'transaction.created': 'normal',
  'transaction.completed': 'normal', 'transaction.failed': 'high', 'transaction.reversed': 'high',
  'payment.received': 'normal', 'payment.failed': 'high', 'payment.refunded': 'normal', 'order.created': 'normal',
  'order.confirmed': 'normal', 'order.shipped': 'normal', 'order.delivered': 'normal', 'order.cancelled': 'normal',
  'subscription.started': 'normal', 'subscription.renewal_due': 'normal', 'subscription.renewed': 'normal',
  'subscription.cancelled': 'normal', 'subscription.payment_failed': 'high', 'security.suspicious_activity': 'critical',
  'security.mfa_enabled': 'high', 'security.mfa_disabled': 'critical', 'promotion.available': 'low',
  'promotion.expiring': 'low', 'system.maintenance_scheduled': 'normal', 'system.maintenance_started': 'high',
  'system.maintenance_completed': 'normal',
};

export interface EventFactoryOptions {
  userId: string;
  source?: string;
  correlationId?: string;
  occurredAt?: string;
  eventId?: string;
}

export function createEvent<T extends EventType>(
  eventType: T,
  payload: EventPayloadMap[T],
  options: EventFactoryOptions,
): EventEnvelope<T> {
  const validatedPayload = payloadSchemas[eventType].parse(payload);
  return {
    event_id: options.eventId ?? randomUUID(),
    event_type: eventType,
    event_version: '1.0',
    occurred_at: options.occurredAt ?? new Date().toISOString(),
    user_id: options.userId,
    correlation_id: options.correlationId ?? randomUUID(),
    source: options.source ?? 'notification-engine-test-factory',
    priority: priorityByEventType[eventType],
    payload: validatedPayload,
  };
}

export function validateEvent(event: unknown): EventEnvelope {
  const envelope = z.object({
    event_id: z.string().min(1),
    event_type: z.enum(eventTypes),
    event_version: z.literal('1.0'),
    occurred_at: z.string().datetime({ offset: true }),
    user_id: z.string().min(1),
    correlation_id: z.string().min(1),
    source: z.string().min(1),
    priority: z.enum(['low', 'normal', 'high', 'critical']),
    payload: z.unknown(),
  }).parse(event);
  const payload = payloadSchemas[envelope.event_type].parse(envelope.payload);
  return { ...envelope, payload } as EventEnvelope;
}