import type { ConsentChannel } from '../../compliance/types.js';

export interface PreparedNotification {
  id: string;
  userId: string;
  channel: ConsentChannel;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export type DeliveryStatus =
  'accepted' | 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';

export interface DeliveryReceipt {
  externalId: string;
  status: DeliveryStatus;
  provider: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: unknown;
}

export interface RecipientValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ProviderQuota {
  remaining?: number;
  limit?: number;
  resetAt?: string;
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  checkedAt: string;
  message?: string;
}

export interface DeliveryProvider {
  send(notification: PreparedNotification): Promise<DeliveryReceipt>;

  getStatus(externalId: string): Promise<DeliveryReceipt>;

  validateRecipient(address: string): Promise<RecipientValidationResult>;

  getQuota(): Promise<ProviderQuota>;

  healthCheck(): Promise<ProviderHealth>;
}
