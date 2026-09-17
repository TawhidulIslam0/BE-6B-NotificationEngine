import type {
  DlqDashboardRepository,
  DlqListOptions,
} from './dlq-dashboard-repository.js';

import type { DlqConsumer } from './dlq-consumer.js';

import type { DlqEntry } from './types.js';

export interface DlqDashboardEntry extends DlqEntry {
  id: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface DlqDashboardListResult {
  entries: DlqDashboardEntry[];
  total: number;
}

export class DlqDashboardService {
  private readonly repository: DlqDashboardRepository;
  private readonly consumer: DlqConsumer;

  public constructor(
    repository: DlqDashboardRepository,
    consumer: DlqConsumer,
  ) {
    this.repository = repository;
    this.consumer = consumer;
  }

  public async list(
    options: DlqListOptions = {},
  ): Promise<DlqDashboardListResult> {
    const result = await this.repository.list(options);

    return {
      entries: result.entries.map((entry) => this.toDashboardEntry(entry)),
      total: result.total,
    };
  }

  public async retry(id: string): Promise<DlqDashboardEntry> {
    const result = await this.consumer.retry(id);

    return this.toDashboardEntry(result.entry);
  }

  public async discard(id: string): Promise<DlqDashboardEntry> {
    const entry = await this.repository.discard(id);

    if (!entry) {
      throw new Error(`DLQ entry ${id} not found or is already resolved`);
    }

    return this.toDashboardEntry(entry);
  }

  private toDashboardEntry(entry: DlqEntry): DlqDashboardEntry {
    if (entry.id === undefined || entry.createdAt === undefined) {
      throw new Error('DLQ dashboard entry is missing database metadata');
    }

    return {
      id: entry.id,
      eventId: entry.eventId,
      eventType: entry.eventType,
      payload: entry.payload,
      reason: entry.reason,
      retryCount: entry.retryCount,
      status: entry.status,
      nextRetryAt: entry.nextRetryAt ?? null,
      createdAt: entry.createdAt,
      resolvedAt: entry.resolvedAt ?? null,
    };
  }
}
