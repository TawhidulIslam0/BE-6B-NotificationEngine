import type { EventPriority } from '../../events/types/events.js';

export interface RetryPolicy {
  priority: EventPriority;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMaxMs: number;
}

export interface RetrySchedule {
  attempt: number;
  delayMs: number;
  retryAt: Date;
}

export interface RetryPolicyConfig {
  policies: Record<EventPriority, RetryPolicy>;
}
