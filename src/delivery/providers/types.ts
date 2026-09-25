import type { ConsentChannel } from '../../compliance/types.js';

/** Channel-specific notification ready to be sent by a provider. */
export interface PreparedNotification {
  id: string;
  userId: string;
  channel: ConsentChannel;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/** Normalized status returned by notification providers. */
export type DeliveryStatus =
  'accepted' | 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';

/** Provider response normalized for persistence and retry decisions. */
export interface DeliveryReceipt {
  externalId: string;
  status: DeliveryStatus;
  provider: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: unknown;
}

/** Result of validating a provider-specific recipient address. */
export interface RecipientValidationResult {
  valid: boolean;
  reason?: string;
}

/** Optional provider quota information. */
export interface ProviderQuota {
  remaining?: number;
  limit?: number;
  resetAt?: string;
}

/** Point-in-time health result for a delivery provider. */
export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  checkedAt: string;
  message?: string;
}

/** Common contract implemented by all notification providers. */
export interface DeliveryProvider {
  send(notification: PreparedNotification): Promise<DeliveryReceipt>;

  getStatus(externalId: string): Promise<DeliveryReceipt>;

  validateRecipient(address: string): Promise<RecipientValidationResult>;

  getQuota(): Promise<ProviderQuota>;

  healthCheck(): Promise<ProviderHealth>;
}
