import type { EventPriority } from '../../events/types/events.js';

import type { PreparedNotification } from '../providers/types.js';

import type { DlqProcessor } from '../dlq/dlq-processor.js';

import { RetryBudgetMonitor } from './retry-budget.js';

import { RetryScheduler, type RetryJob } from './retry-scheduler.js';

export interface RetryNotificationRepository {
  findById(notificationId: string): Promise<PreparedNotification | null>;
}

export interface RetryDeliveryService {
  send(notification: PreparedNotification): Promise<void>;
}

export interface RetryWorkerResult {
  notificationId: string;
  attempt: number;
  success: boolean;
  retryScheduled: boolean;
  retryAt?: Date;
  error?: string;
  dlqClassification?: 'transient' | 'permanent' | 'configuration';
}

export class RetryWorker {
  private readonly scheduler: RetryScheduler;
  private readonly repository: RetryNotificationRepository;
  private readonly deliveryService: RetryDeliveryService;
  private readonly dlqProcessor: DlqProcessor;
  private readonly retryBudget: RetryBudgetMonitor;

  public constructor(
    scheduler: RetryScheduler,
    repository: RetryNotificationRepository,
    deliveryService: RetryDeliveryService,
    dlqProcessor: DlqProcessor,
    retryBudget: RetryBudgetMonitor,
  ) {
    this.scheduler = scheduler;
    this.repository = repository;
    this.deliveryService = deliveryService;
    this.dlqProcessor = dlqProcessor;
    this.retryBudget = retryBudget;
  }

  public async processJob(job: RetryJob): Promise<RetryWorkerResult> {
    const notification = await this.repository.findById(job.notificationId);

    if (!notification) {
      await this.scheduler.removeJob(job);

      return {
        notificationId: job.notificationId,
        attempt: job.attempt,
        success: false,
        retryScheduled: false,
        error: 'Notification not found',
      };
    }

    try {
      await this.deliveryService.send(notification);

      await this.scheduler.removeJob(job);

      return {
        notificationId: job.notificationId,
        attempt: job.attempt,
        success: true,
        retryScheduled: false,
      };
    } catch (error) {
      const priority: EventPriority = job.priority;

      const nextAttempt = job.attempt + 1;

      /*
       * First check the priority-specific
       * maximum retry policy.
       */
      if (!this.canScheduleRetry(priority, nextAttempt)) {
        const dlqResult = await this.dlqProcessor.processFailure({
          eventId: job.eventId,
          eventType: job.eventType,
          payload: job.payload,
          failure: {
            error,
            retryCount: job.attempt,
          },
        });

        await this.scheduler.removeJob(job);

        return {
          notificationId: job.notificationId,
          attempt: job.attempt,
          success: false,
          retryScheduled: false,
          error: this.getErrorMessage(error),
          dlqClassification: dlqResult.classification,
        };
      }

      /*
       * The retry policy allows another
       * attempt, so check the global retry
       * budget before scheduling it.
       */
      const budgetAvailable = await this.retryBudget.consume();

      if (!budgetAvailable) {
        const dlqResult = await this.dlqProcessor.processFailure({
          eventId: job.eventId,
          eventType: job.eventType,
          payload: job.payload,
          failure: {
            error: new Error(
              `Retry budget exhausted: ${this.getErrorMessage(error)}`,
            ),
            retryCount: job.attempt,
          },
        });

        await this.scheduler.removeJob(job);

        return {
          notificationId: job.notificationId,
          attempt: job.attempt,
          success: false,
          retryScheduled: false,
          error: 'Retry budget exhausted',
          dlqClassification: dlqResult.classification,
        };
      }

      /*
       * Both the retry policy and retry
       * budget allow another attempt.
       */
      const schedule = await this.scheduler.schedule(
        notification.id,
        priority,
        nextAttempt,
        job.eventId,
        job.eventType,
        job.payload,
      );

      await this.scheduler.removeJob(job);

      return {
        notificationId: job.notificationId,
        attempt: job.attempt,
        success: false,
        retryScheduled: true,
        retryAt: schedule.retryAt,
        error: this.getErrorMessage(error),
      };
    }
  }

  public async processDueJobs(
    now: Date = new Date(),
  ): Promise<RetryWorkerResult[]> {
    const jobs = await this.scheduler.getDueJobs(now);

    const results: RetryWorkerResult[] = [];

    for (const job of jobs) {
      const result = await this.processJob(job);

      results.push(result);
    }

    return results;
  }

  private canScheduleRetry(priority: EventPriority, attempt: number): boolean {
    const service = this.scheduler.getPolicyService();

    return service.canRetry(priority, attempt);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
