import type { ConsentChannel, ConsentRecord, ConsentStatus } from './types.js';

/** Stores current consent state and an append-only in-memory audit history. */
export class ConsentService {
  private readonly current = new Map<string, ConsentRecord>();

  private readonly auditLog: ConsentRecord[] = [];

  /** Records and returns the latest consent decision for a user and channel. */
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

  /** Returns the current consent record, if one exists. */
  get(userId: string, channel: ConsentChannel): ConsentRecord | undefined {
    return this.current.get(`${userId}:${channel}`);
  }

  /** Reports whether the user is opted in for the requested channel. */
  hasConsent(userId: string, channel: ConsentChannel): boolean {
    return this.get(userId, channel)?.status === 'OPTED_IN';
  }

  /** Returns a snapshot of all recorded consent decisions. */
  getAuditLog(): readonly ConsentRecord[] {
    return [...this.auditLog];
  }
}
