import type { DlqProcessorResult } from '../dlq/dlq-processor.js';

export interface RetryDlqHandler {
  processFailure(input: {
    eventId: string;
    eventType: string;
    payload: unknown;
    retryCount: number;
    error: unknown;
    provider?: string;
    statusCode?: number;
    errorCode?: string;
  }): Promise<DlqProcessorResult>;
}
