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

export type EventType = (typeof eventTypes)[number];
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export interface UserRegisteredPayload {
  name: string;
  email: string;
}
export interface UserWelcomePayload {
  name: string;
}
export interface UserEmailVerifiedPayload {
  email: string;
}
export interface UserPhoneVerifiedPayload {
  phone: string;
}
export interface UserPasswordChangedPayload {
  changedAt: string;
}
export interface UserPasswordResetRequestedPayload {
  resetUrl: string;
  expiresAt: string;
}
export interface UserLoginNewDevicePayload {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
}
export interface UserAccountLockedPayload {
  reason: string;
  lockedUntil?: string;
}
export interface UserAccountUnlockedPayload {
  unlockedAt: string;
}
export interface TransactionPayload {
  transactionId: string;
  amount: number;
  currency: string;
}
export interface TransactionFailedPayload extends TransactionPayload {
  reason: string;
}
export interface TransactionReversedPayload extends TransactionPayload {
  reversalReason: string;
}
export interface PaymentPayload {
  paymentId: string;
  amount: number;
  currency: string;
}
export interface PaymentFailedPayload extends PaymentPayload {
  reason: string;
}
export interface PaymentRefundedPayload extends PaymentPayload {
  refundedAmount: number;
}
export interface OrderPayload {
  orderId: string;
}
export interface OrderShippedPayload extends OrderPayload {
  trackingNumber: string;
  carrier: string;
}
export interface SubscriptionPayload {
  subscriptionId: string;
  plan: string;
}
export interface SubscriptionRenewalDuePayload extends SubscriptionPayload {
  dueAt: string;
}
export interface SubscriptionPaymentFailedPayload extends SubscriptionPayload {
  reason: string;
}
export interface SecuritySuspiciousActivityPayload {
  activity: string;
  ipAddress: string;
  riskScore: number;
}
export interface SecurityMfaPayload {
  method: string;
}
export interface PromotionPayload {
  promotionId: string;
  title: string;
  expiresAt?: string;
}
export interface SystemMaintenancePayload {
  message: string;
  startsAt?: string;
  endsAt?: string;
}

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
