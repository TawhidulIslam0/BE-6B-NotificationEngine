import { describe, expect, it } from 'vitest';
import { createEvent, validateEvent } from '../src/events/factory/event-factory.js';
import { payloadSchemas } from '../src/events/schemas/event-schemas.js';
import { eventTypes, type EventType } from '../src/events/types/events.js';

const validPayloads: Record<EventType, Record<string, unknown>> = {
  'user.registered': { name: 'Ada', email: 'ada@example.com' },
  'user.welcome': { name: 'Ada' },
  'user.email_verified': { email: 'ada@example.com' },
  'user.phone_verified': { phone: '+15550000001' },
  'user.password_changed': { changedAt: '2026-01-01T00:00:00.000Z' },
  'user.password_reset_requested': { resetUrl: 'https://example.com/reset', expiresAt: '2026-01-01T00:00:00.000Z' },
  'user.login_new_device': { deviceId: 'device-1', ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  'user.account_locked': { reason: 'too many attempts' },
  'user.account_unlocked': { unlockedAt: '2026-01-01T00:00:00.000Z' },
  'transaction.created': { transactionId: 'txn-1', amount: 10, currency: 'USD' },
  'transaction.completed': { transactionId: 'txn-1', amount: 10, currency: 'USD' },
  'transaction.failed': { transactionId: 'txn-1', amount: 10, currency: 'USD', reason: 'declined' },
  'transaction.reversed': { transactionId: 'txn-1', amount: 10, currency: 'USD', reversalReason: 'duplicate' },
  'payment.received': { paymentId: 'pay-1', amount: 10, currency: 'USD' },
  'payment.failed': { paymentId: 'pay-1', amount: 10, currency: 'USD', reason: 'declined' },
  'payment.refunded': { paymentId: 'pay-1', amount: 10, currency: 'USD', refundedAmount: 10 },
  'order.created': { orderId: 'order-1' },
  'order.confirmed': { orderId: 'order-1' },
  'order.shipped': { orderId: 'order-1', trackingNumber: 'track-1', carrier: 'carrier' },
  'order.delivered': { orderId: 'order-1' },
  'order.cancelled': { orderId: 'order-1' },
  'subscription.started': { subscriptionId: 'sub-1', plan: 'pro' },
  'subscription.renewal_due': { subscriptionId: 'sub-1', plan: 'pro', dueAt: '2026-01-01T00:00:00.000Z' },
  'subscription.renewed': { subscriptionId: 'sub-1', plan: 'pro' },
  'subscription.cancelled': { subscriptionId: 'sub-1', plan: 'pro' },
  'subscription.payment_failed': { subscriptionId: 'sub-1', plan: 'pro', reason: 'declined' },
  'security.suspicious_activity': { activity: 'new country', ipAddress: '127.0.0.1', riskScore: 80 },
  'security.mfa_enabled': { method: 'totp' },
  'security.mfa_disabled': { method: 'totp' },
  'promotion.available': { promotionId: 'promo-1', title: 'Welcome offer' },
  'promotion.expiring': { promotionId: 'promo-1', title: 'Welcome offer', expiresAt: '2026-01-01T00:00:00.000Z' },
  'system.maintenance_scheduled': { message: 'Scheduled maintenance' },
  'system.maintenance_started': { message: 'Maintenance started' },
  'system.maintenance_completed': { message: 'Maintenance completed' },
};

describe('event payload validators', () => {
  it.each(eventTypes)('accepts a valid %s payload', (eventType) => {
    expect(payloadSchemas[eventType].safeParse(validPayloads[eventType]).success).toBe(true);
  });

  it.each(eventTypes)('rejects an empty %s payload', (eventType) => {
    expect(payloadSchemas[eventType].safeParse({}).success).toBe(false);
  });

  it('rejects malformed payload values', () => {
    expect(payloadSchemas['user.registered'].safeParse({ name: '', email: 'invalid' }).success).toBe(false);
    expect(payloadSchemas['payment.received'].safeParse({ paymentId: 'p', amount: -1, currency: 'US' }).success).toBe(false);
    expect(payloadSchemas['security.suspicious_activity'].safeParse({ activity: 'x', ipAddress: 'x', riskScore: 101 }).success).toBe(false);
  });
});

describe('event factory', () => {
  it('creates a complete typed envelope with defaults', () => {
    const event = createEvent('order.created', { orderId: 'order-1' }, { userId: 'user-1' });
    expect(event.event_type).toBe('order.created');
    expect(event.event_version).toBe('1.0');
    expect(event.priority).toBe('normal');
    expect(event.event_id).toBeTruthy();
  });

  it('validates a complete envelope and rejects invalid metadata', () => {
    const event = createEvent('user.welcome', { name: 'Ada' }, { userId: 'user-1' });
    expect(validateEvent(event).payload).toEqual({ name: 'Ada' });
    expect(() => validateEvent({ ...event, event_version: '2.0' })).toThrow();
    expect(() => validateEvent({ ...event, payload: {} })).toThrow();
  });
});