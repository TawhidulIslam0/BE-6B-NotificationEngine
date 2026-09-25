import type Redis from 'ioredis';

import type { EventPriority } from '../../events/types/events.js';

import type { RetrySchedule } from './types.js';

import { RetryPolicyService } from './retry-policy.js';

/** Delayed delivery job scheduled for another attempt. */
export interface RetryJob {
  notificationId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  priority: EventPriority;
  attempt: number;
  retryAt: Date;
}

/** Schedules and retrieves delayed notification retry jobs. */
export class RetryScheduler {
  private readonly redis: Redis;
  private readonly policyService: RetryPolicyService;
  private readonly retryQueueKey: string;

  public constructor(
    redis: Redis,
    policyService: RetryPolicyService = new RetryPolicyService(),
    retryQueueKey = 'notification:retry:queue',
  ) {
    this.redis = redis;
    this.policyService = policyService;
    this.retryQueueKey = retryQueueKey;
  }

  public getQueueKey(): string {
    return this.retryQueueKey;
  }

  public getPolicyService(): RetryPolicyService {
    return this.policyService;
  }

  public schedule(
    notificationId: string,
    priority: EventPriority,
    attempt: number,
    eventId: string,
    eventType: string,
    payload: unknown,
    now: Date = new Date(),
    random: () => number = Math.random,
  ): Promise<RetrySchedule> {
    const schedule = this.policyService.schedule(
      priority,
      attempt,
      now,
      random,
    );

    return this.addToQueue(
      notificationId,
      priority,
      schedule,
      eventId,
      eventType,
      payload,
    ).then(() => schedule);
  }

  public async addToQueue(
    notificationId: string,
    priority: EventPriority,
    schedule: RetrySchedule,
    eventId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const job: RetryJob = {
      notificationId,
      eventId,
      eventType,
      payload,
      priority,
      attempt: schedule.attempt,
      retryAt: schedule.retryAt,
    };

    await this.redis.zadd(
      this.retryQueueKey,
      schedule.retryAt.getTime(),
      JSON.stringify(job),
    );
  }

  public async getDueJobs(now: Date = new Date()): Promise<RetryJob[]> {
    const members = await this.redis.zrangebyscore(
      this.retryQueueKey,
      0,
      now.getTime(),
    );

    return members.map((member) => {
      const job = JSON.parse(member) as Omit<RetryJob, 'retryAt'> & {
        retryAt: string;
      };

      return {
        ...job,
        retryAt: new Date(job.retryAt),
      };
    });
  }

  public async removeJob(job: RetryJob): Promise<number> {
    return this.redis.zrem(this.retryQueueKey, JSON.stringify(job));
  }
}
