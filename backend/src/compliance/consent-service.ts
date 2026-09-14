import type {
  ConsentChannel,
  ConsentRecord,
  ConsentStatus,
} from './types.js';

export class ConsentService {
  private readonly current = new Map<
    string,
    ConsentRecord
  >();

  private readonly auditLog: ConsentRecord[] = [];

  record(
    userId: string,
    channel: ConsentChannel,
    status: ConsentStatus,
    reason?: string,
  ): ConsentRecord {
    const record: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      channel,
      status,
      reason,
      recordedAt: new Date().toISOString(),
      source: 'consent-service',
    };

    this.current.set(`${userId}:${channel}`, record);
    this.auditLog.push(record);

    return record;
  }

  get(
    userId: string,
    channel: ConsentChannel,
  ): ConsentRecord | undefined {
    return this.current.get(`${userId}:${channel}`);
  }

  hasConsent(
    userId: string,
    channel: ConsentChannel,
  ): boolean {
    return this.get(userId, channel)?.status === 'OPTED_IN';
  }

  getAuditLog(): readonly ConsentRecord[] {
    return [...this.auditLog];
  }
}