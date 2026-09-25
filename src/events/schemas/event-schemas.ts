import { z } from 'zod';
import type { EventPayloadMap, EventType } from '../types/events.js';

const requiredText = z.string().min(1);
const email = z.string().email();
const timestamp = z.string().datetime({ offset: true });
const amount = z.number().finite().nonnegative();
const currency = z.string().length(3).toUpperCase();

const userRegistered = z.object({ name: requiredText, email });
const userWelcome = z.object({ name: requiredText });
const userEmailVerified = z.object({ email });
const userPhoneVerified = z.object({ phone: requiredText });
const passwordChanged = z.object({ changedAt: timestamp });
const passwordReset = z.object({
  resetUrl: z.string().url(),
  expiresAt: timestamp,
});
const loginNewDevice = z.object({
  deviceId: requiredText,
  ipAddress: requiredText,
  userAgent: requiredText,
});
const accountLocked = z.object({
  reason: requiredText,
  lockedUntil: timestamp.optional(),
});
const accountUnlocked = z.object({ unlockedAt: timestamp });
const transaction = z.object({ transactionId: requiredText, amount, currency });
const transactionFailed = transaction.extend({ reason: requiredText });
const transactionReversed = transaction.extend({
  reversalReason: requiredText,
});
const payment = z.object({ paymentId: requiredText, amount, currency });
const paymentFailed = payment.extend({ reason: requiredText });
const paymentRefunded = payment.extend({ refundedAmount: amount });
const order = z.object({ orderId: requiredText });
const orderShipped = order.extend({
  trackingNumber: requiredText,
  carrier: requiredText,
});
const subscription = z.object({
  subscriptionId: requiredText,
  plan: requiredText,
});
const renewalDue = subscription.extend({ dueAt: timestamp });
const subscriptionPaymentFailed = subscription.extend({ reason: requiredText });
const suspiciousActivity = z.object({
  activity: requiredText,
  ipAddress: requiredText,
  riskScore: z.number().min(0).max(100),
});
const mfa = z.object({ method: requiredText });
const promotion = z.object({
  promotionId: requiredText,
  title: requiredText,
  expiresAt: timestamp.optional(),
});
const maintenance = z.object({
  message: requiredText,
  startsAt: timestamp.optional(),
  endsAt: timestamp.optional(),
});

/** Runtime validators keyed by every event in the canonical taxonomy. */
export const payloadSchemas: {
  [T in EventType]: z.ZodType<EventPayloadMap[T]>;
} = {
  'user.registered': userRegistered,
  'user.welcome': userWelcome,
  'user.email_verified': userEmailVerified,
  'user.phone_verified': userPhoneVerified,
  'user.password_changed': passwordChanged,
  'user.password_reset_requested': passwordReset,
  'user.login_new_device': loginNewDevice,
  'user.account_locked': accountLocked,
  'user.account_unlocked': accountUnlocked,
  'transaction.created': transaction,
  'transaction.completed': transaction,
  'transaction.failed': transactionFailed,
  'transaction.reversed': transactionReversed,
  'payment.received': payment,
  'payment.failed': paymentFailed,
  'payment.refunded': paymentRefunded,
  'order.created': order,
  'order.confirmed': order,
  'order.shipped': orderShipped,
  'order.delivered': order,
  'order.cancelled': order,
  'subscription.started': subscription,
  'subscription.renewal_due': renewalDue,
  'subscription.renewed': subscription,
  'subscription.cancelled': subscription,
  'subscription.payment_failed': subscriptionPaymentFailed,
  'security.suspicious_activity': suspiciousActivity,
  'security.mfa_enabled': mfa,
  'security.mfa_disabled': mfa,
  'promotion.available': promotion,
  'promotion.expiring': promotion,
  'system.maintenance_scheduled': maintenance,
  'system.maintenance_started': maintenance,
  'system.maintenance_completed': maintenance,
};

/** Validates and returns the typed payload for a specific event type. */
export function validatePayload<T extends EventType>(
  eventType: T,
  payload: unknown,
): EventPayloadMap[T] {
  return payloadSchemas[eventType].parse(payload);
}
