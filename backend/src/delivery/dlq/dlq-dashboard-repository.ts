import type { Knex } from 'knex';

import type { DlqEntry } from './types.js';

export interface DlqListOptions {
  classification?: 'transient' | 'permanent' | 'configuration';
  status?: DlqEntry['status'];
  limit?: number;
  offset?: number;
}

export interface DlqListResult {
  entries: DlqEntry[];
  total: number;
}

interface DlqDatabaseRow {
  id: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  reason: string;
  retry_count: number;
  status: string;
  next_retry_at: Date | null;
  created_at: Date;
  resolved_at: Date | null;
}

export class DlqDashboardRepository {
  private readonly db: Knex;

  public constructor(db: Knex) {
    this.db = db;
  }

  public async list(options: DlqListOptions = {}): Promise<DlqListResult> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

    const offset = Math.max(options.offset ?? 0, 0);

    const baseQuery = this.db<DlqDatabaseRow>('dead_letter_queue');

    if (options.classification) {
      baseQuery.where('reason', 'like', `[${options.classification}]%`);
    }

    if (options.status) {
      baseQuery.where('status', options.status);
    }

    const countQuery = baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string }[]>({
        count: '*',
      })
      .first();

    const rowsQuery = baseQuery
      .clone()
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const [countRow, rows] = await Promise.all([countQuery, rowsQuery]);

    return {
      entries: rows.map((row) => this.toDlqEntry(row)),
      total: Number(countRow?.count ?? 0),
    };
  }

  public async findById(id: string): Promise<DlqEntry | null> {
    const row = await this.db<DlqDatabaseRow>('dead_letter_queue')
      .where('id', id)
      .first();

    if (!row) {
      return null;
    }

    return this.toDlqEntry(row);
  }

  public async markForRetry(id: string): Promise<DlqEntry | null> {
    const updated = await this.db<DlqDatabaseRow>('dead_letter_queue')
      .where('id', id)
      .where('status', 'pending')
      .update({
        status: 'processing',
        next_retry_at: new Date(),
        resolved_at: null,
      })
      .returning('*');

    if (updated.length === 0) {
      return null;
    }

    return this.toDlqEntry(updated[0]);
  }

  public async discard(id: string): Promise<DlqEntry | null> {
    const updated = await this.db<DlqDatabaseRow>('dead_letter_queue')
      .where('id', id)
      .whereNot('status', 'resolved')
      .update({
        status: 'resolved',
        resolved_at: new Date(),
      })
      .returning('*');

    if (updated.length === 0) {
      return null;
    }

    return this.toDlqEntry(updated[0]);
  }

  private toDlqEntry(row: DlqDatabaseRow): DlqEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      reason: row.reason,
      retryCount: row.retry_count,
      status: row.status as DlqEntry['status'],
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  }
}
