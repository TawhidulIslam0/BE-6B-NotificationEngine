import type { Knex } from 'knex';

import type { DlqEntry } from './types.js';

/** Database representation of a dead-letter record. */
export interface DlqDatabaseRow {
  id?: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  reason: string;
  retry_count: number;
  status: string;
  next_retry_at: Date | null;
  created_at?: Date;
  resolved_at?: Date | null;
}

/** PostgreSQL repository for dead-letter records. */
export class DlqPostgresRepository {
  private readonly db: Knex;

  public constructor(db: Knex) {
    this.db = db;
  }

  public async insert(entry: DlqEntry): Promise<void> {
    await this.db<DlqDatabaseRow>('dead_letter_queue').insert({
      event_id: entry.eventId,
      event_type: entry.eventType,
      payload: entry.payload,
      reason: entry.reason,
      retry_count: entry.retryCount,
      status: entry.status,
      next_retry_at: entry.nextRetryAt ?? null,
    });
  }

  public async findByEventId(eventId: string): Promise<DlqEntry | null> {
    const row = await this.db<DlqDatabaseRow>('dead_letter_queue')
      .where('event_id', eventId)
      .first();

    if (!row) {
      return null;
    }

    return {
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      reason: row.reason,
      retryCount: row.retry_count,
      status: row.status as DlqEntry['status'],
      nextRetryAt: row.next_retry_at,
    };
  }
}
