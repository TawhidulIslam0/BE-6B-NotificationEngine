/** Stored result used to prevent duplicate notification dispatch. */
export interface IdempotencyRecord {
  key: string;
  provider: string;
  externalId: string;
  recordedAt: number;
}

/** In-memory idempotency store for notification dispatch operations. */
export class IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  public has(key: string): boolean {
    return this.records.has(key);
  }

  public get(key: string): IdempotencyRecord | undefined {
    return this.records.get(key);
  }

  public set(record: IdempotencyRecord): void {
    this.records.set(record.key, {
      ...record,
    });
  }

  public createKey(notificationId: string, channel: string): string {
    return `${notificationId}:${channel}`;
  }
}
