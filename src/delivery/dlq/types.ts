export type DlqFailureClassification =
  'transient' | 'permanent' | 'configuration';

export interface DlqFailureContext {
  error: unknown;
  retryCount: number;
  provider?: string;
  statusCode?: number;
  errorCode?: string;
}

export interface DlqClassification {
  classification: DlqFailureClassification;
  reason: string;
}

export interface DlqEntry {
  id?: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  reason: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'resolved';
  nextRetryAt?: Date | null;
  createdAt?: Date;
  resolvedAt?: Date | null;
}
