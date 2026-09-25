/** Canonical event names accepted by the notification engine. */
export const eventTypes = [
  'user.registered',
  'user.welcome',
  'user.email_verified',
  'user.phone_verified',
  'user.password_changed',
  'user.password_reset_requested',
  'user.login_new_device',
  'user.account_locked',
  'user.account_unlocked',
  'transaction.created',
  'transaction.completed',
  'transaction.failed',
  'transaction.reversed',
  'payment.received',
  'payment.failed',
  'payment.refunded',
  'order.created',
  'order.confirmed',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'subscription.started',
  'subscription.renewal_due',
  'subscription.renewed',
  'subscription.cancelled',
  'subscription.payment_failed',
  'security.suspicious_activity',
  'security.mfa_enabled',
  'security.mfa_disabled',
  'promotion.available',
  'promotion.expiring',
  'system.maintenance_scheduled',
  'system.maintenance_started',
  'system.maintenance_completed',
] as const;

/** Event name constrained to the canonical taxonomy. */
export type EventType = (typeof eventTypes)[number];
/** Processing urgency assigned to an event. */
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

/** Payload emitted after a user completes registration. */
export interface UserRegisteredPayload {
  name: string;
  email: string;
}
/** Payload for a user welcome notification. */
export interface UserWelcomePayload {
  name: string;
}
/** Payload emitted when a user verifies an email address. */
export interface UserEmailVerifiedPayload {
  email: string;
}
/** Payload emitted when a user verifies a phone number. */
export interface UserPhoneVerifiedPayload {
  phone: string;
}
/** Payload emitted after a password change. */
export interface UserPasswordChangedPayload {
  changedAt: string;
}
/** Payload containing a password-reset link and expiry. */
export interface UserPasswordResetRequestedPayload {
  resetUrl: string;
  expiresAt: string;
}
/** Payload describing a login from a previously unseen device. */
export interface UserLoginNewDevicePayload {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
}
/** Payload describing an account lock decision. */
export interface UserAccountLockedPayload {
  reason: string;
  lockedUntil?: string;
}
/** Payload emitted when an account lock is removed. */
export interface UserAccountUnlockedPayload {
  unlockedAt: string;
}
/** Shared payload for transaction lifecycle events. */
export interface TransactionPayload {
  transactionId: string;
  amount: number;
  currency: string;
}
/** Payload for a failed transaction, including the failure reason. */
export interface TransactionFailedPayload extends TransactionPayload {
  reason: string;
}
/** Payload for a reversed transaction. */
export interface TransactionReversedPayload extends TransactionPayload {
  reversalReason: string;
}
/** Shared payload for payment lifecycle events. */
export interface PaymentPayload {
  paymentId: string;
  amount: number;
  currency: string;
}
/** Payload for a failed payment. */
export interface PaymentFailedPayload extends PaymentPayload {
  reason: string;
}
/** Payload for a refunded payment. */
export interface PaymentRefundedPayload extends PaymentPayload {
  refundedAmount: number;
}
/** Shared payload for order lifecycle events. */
export interface OrderPayload {
  orderId: string;
}
/** Payload for an order shipped event. */
export interface OrderShippedPayload extends OrderPayload {
  trackingNumber: string;
  carrier: string;
}
/** Shared payload for subscription lifecycle events. */
export interface SubscriptionPayload {
  subscriptionId: string;
  plan: string;
}
/** Payload notifying a user that renewal is due. */
export interface SubscriptionRenewalDuePayload extends SubscriptionPayload {
  dueAt: string;
}
/** Payload for a failed subscription payment. */
export interface SubscriptionPaymentFailedPayload extends SubscriptionPayload {
  reason: string;
}
/** Payload describing detected suspicious activity. */
export interface SecuritySuspiciousActivityPayload {
  activity: string;
  ipAddress: string;
  riskScore: number;
}
/** Payload describing an MFA state change. */
export interface SecurityMfaPayload {
  method: string;
}
/** Payload for a promotional offer event. */
export interface PromotionPayload {
  promotionId: string;
  title: string;
  expiresAt?: string;
}
/** Payload describing a system maintenance lifecycle event. */
export interface SystemMaintenancePayload {
  message: string;
  startsAt?: string;
  endsAt?: string;
}

/** Maps each canonical event name to its validated payload type. */
export interface EventPayloadMap {
  'user.registered': UserRegisteredPayload;
  'user.welcome': UserWelcomePayload;
  'user.email_verified': UserEmailVerifiedPayload;
  'user.phone_verified': UserPhoneVerifiedPayload;
  'user.password_changed': UserPasswordChangedPayload;
  'user.password_reset_requested': UserPasswordResetRequestedPayload;
  'user.login_new_device': UserLoginNewDevicePayload;
  'user.account_locked': UserAccountLockedPayload;
  'user.account_unlocked': UserAccountUnlockedPayload;
  'transaction.created': TransactionPayload;
  'transaction.completed': TransactionPayload;
  'transaction.failed': TransactionFailedPayload;
  'transaction.reversed': TransactionReversedPayload;
  'payment.received': PaymentPayload;
  'payment.failed': PaymentFailedPayload;
  'payment.refunded': PaymentRefundedPayload;
  'order.created': OrderPayload;
  'order.confirmed': OrderPayload;
  'order.shipped': OrderShippedPayload;
  'order.delivered': OrderPayload;
  'order.cancelled': OrderPayload;
  'subscription.started': SubscriptionPayload;
  'subscription.renewal_due': SubscriptionRenewalDuePayload;
  'subscription.renewed': SubscriptionPayload;
  'subscription.cancelled': SubscriptionPayload;
  'subscription.payment_failed': SubscriptionPaymentFailedPayload;
  'security.suspicious_activity': SecuritySuspiciousActivityPayload;
  'security.mfa_enabled': SecurityMfaPayload;
  'security.mfa_disabled': SecurityMfaPayload;
  'promotion.available': PromotionPayload;
  'promotion.expiring': PromotionPayload;
  'system.maintenance_scheduled': SystemMaintenancePayload;
  'system.maintenance_started': SystemMaintenancePayload;
  'system.maintenance_completed': SystemMaintenancePayload;
}

/** Common transport envelope carried through the event pipeline. */
export interface EventEnvelope<T extends EventType = EventType> {
  event_id: string;
  event_type: T;
  event_version: '1.0';
  occurred_at: string;
  user_id: string;
  correlation_id: string;
  source: string;
  priority: EventPriority;
  payload: EventPayloadMap[T];
}
