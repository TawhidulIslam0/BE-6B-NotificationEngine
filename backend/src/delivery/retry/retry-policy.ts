import type { EventPriority } from '../../events/types/events.js';

import type { RetryPolicy, RetryPolicyConfig, RetrySchedule } from './types.js';

const DEFAULT_POLICIES: Record<EventPriority, RetryPolicy> = {
  critical: {
    priority: 'critical',
    maxRetries: 10,
    baseDelayMs: 500,
    maxDelayMs: 60_000,
    jitterMaxMs: 1_000,
  },

  high: {
    priority: 'high',
    maxRetries: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 300_000,
    jitterMaxMs: 1_000,
  },

  normal: {
    priority: 'normal',
    maxRetries: 3,
    baseDelayMs: 5_000,
    maxDelayMs: 1_800_000,
    jitterMaxMs: 1_000,
  },

  low: {
    priority: 'low',
    maxRetries: 2,
    baseDelayMs: 30_000,
    maxDelayMs: 7_200_000,
    jitterMaxMs: 1_000,
  },
};

export class RetryPolicyService {
  private readonly policies: Record<EventPriority, RetryPolicy>;

  public constructor(config: Partial<RetryPolicyConfig['policies']> = {}) {
    this.policies = {
      ...DEFAULT_POLICIES,
      ...config,
    };
  }

  public getPolicy(priority: EventPriority): RetryPolicy {
    return {
      ...this.policies[priority],
    };
  }

  public canRetry(priority: EventPriority, attempt: number): boolean {
    if (!Number.isInteger(attempt) || attempt < 0) {
      throw new Error('Retry attempt must be a non-negative integer');
    }

    return attempt < this.policies[priority].maxRetries;
  }

  public calculateDelay(
    priority: EventPriority,
    attempt: number,
    random: () => number = Math.random,
  ): number {
    if (!Number.isInteger(attempt) || attempt < 0) {
      throw new Error('Retry attempt must be a non-negative integer');
    }

    const policy = this.policies[priority];

    const jitter = Math.min(
      policy.jitterMaxMs,
      Math.floor(random() * (policy.jitterMaxMs + 1)),
    );
    const exponentialDelay = policy.baseDelayMs * 2 ** attempt;

    return Math.min(exponentialDelay + jitter, policy.maxDelayMs);
  }

  public schedule(
    priority: EventPriority,
    attempt: number,
    now: Date = new Date(),
    random: () => number = Math.random,
  ): RetrySchedule {
    if (!this.canRetry(priority, attempt)) {
      throw new Error(`Maximum retries reached for ${priority}`);
    }

    const delayMs = this.calculateDelay(priority, attempt, random);

    return {
      attempt,
      delayMs,
      retryAt: new Date(now.getTime() + delayMs),
    };
  }
}

export { DEFAULT_POLICIES };
