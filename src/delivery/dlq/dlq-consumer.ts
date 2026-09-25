import type { EventPriority } from '../../events/types/events.js';

import type { RetryScheduler } from '../retry/retry-scheduler.js';

import type { DlqEntry } from './types.js';

/** Persistence operations required to retry or resolve DLQ records. */
export interface DlqRetryRepository {
  markForRetry(id: string): Promise<DlqEntry | null>;
}

/** Result summary for one DLQ consumption pass. */
export interface DlqConsumerResult {
  entry: DlqEntry;
  scheduled: boolean;
}

/** Consumes dead-letter records and schedules eligible retries. */
export class DlqConsumer {
  private readonly repository: DlqRetryRepository;
  private readonly scheduler: RetryScheduler;

  public constructor(
    repository: DlqRetryRepository,
    scheduler: RetryScheduler,
  ) {
    this.repository = repository;
    this.scheduler = scheduler;
  }

  public async retry(
    id: string,
    priority: EventPriority = 'normal',
  ): Promise<DlqConsumerResult> {
    const entry = await this.repository.markForRetry(id);

    if (!entry) {
      throw new Error(`DLQ entry ${id} not found or is not pending`);
    }

    const retryAt = new Date();

    await this.scheduler.addToQueue(
      entry.eventId,
      priority,
      {
        attempt: 0,
        delayMs: 0,
        retryAt,
      },
      entry.eventId,
      entry.eventType,
      entry.payload,
    );

    return {
      entry,
      scheduled: true,
    };
  }
}
