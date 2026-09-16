export type DeliveryAcknowledgementStatus =
  'accepted' | 'delivered' | 'failed' | 'opened' | 'clicked';

export interface DeliveryAcknowledgement {
  notificationId: string;
  channel: string;
  provider: string;
  externalId: string;
  status: DeliveryAcknowledgementStatus;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
