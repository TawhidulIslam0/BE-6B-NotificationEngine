import { describe, expect, it } from 'vitest';

import { DEFAULT_POLICIES, RetryPolicyService } from './retry-policy.js';

describe('RetryPolicyService', () => {
  const service = new RetryPolicyService();

  describe('priority policies', () => {
    it('configures CRITICAL with 10 retries, 500ms base, and 60s max', () => {
      expect(service.getPolicy('critical')).toEqual({
        priority: 'critical',
        maxRetries: 10,
        baseDelayMs: 500,
        maxDelayMs: 60_000,
        jitterMaxMs: 1_000,
      });
    });

    it('configures HIGH with 5 retries, 1s base, and 5m max', () => {
      expect(service.getPolicy('high')).toEqual({
        priority: 'high',
        maxRetries: 5,
        baseDelayMs: 1_000,
        maxDelayMs: 300_000,
        jitterMaxMs: 1_000,
      });
    });

    it('maps MEDIUM assignment policy to the existing normal priority', () => {
      expect(service.getPolicy('normal')).toEqual({
        priority: 'normal',
        maxRetries: 3,
        baseDelayMs: 5_000,
        maxDelayMs: 1_800_000,
        jitterMaxMs: 1_000,
      });
    });

    it('configures LOW with 2 retries, 30s base, and 2h max', () => {
      expect(service.getPolicy('low')).toEqual({
        priority: 'low',
        maxRetries: 2,
        baseDelayMs: 30_000,
        maxDelayMs: 7_200_000,
        jitterMaxMs: 1_000,
      });
    });
  });

  describe('exponential backoff', () => {
    it('calculates the base exponential delay when jitter is zero', () => {
      expect(service.calculateDelay('critical', 0, () => 0)).toBe(500);

      expect(service.calculateDelay('critical', 1, () => 0)).toBe(1_000);

      expect(service.calculateDelay('critical', 2, () => 0)).toBe(2_000);
    });

    it('adds jitter between zero and one second', () => {
      expect(service.calculateDelay('high', 0, () => 0)).toBe(1_000);

      expect(service.calculateDelay('high', 0, () => 1)).toBe(2_000);
    });

    it('caps the delay at the configured maximum', () => {
      expect(service.calculateDelay('critical', 20, () => 1)).toBe(60_000);

      expect(service.calculateDelay('low', 20, () => 1)).toBe(7_200_000);
    });
  });

  describe('retry limits', () => {
    it('allows attempts below the maximum retry count', () => {
      expect(service.canRetry('critical', 9)).toBe(true);

      expect(service.canRetry('low', 1)).toBe(true);
    });

    it('rejects attempts at the maximum retry count', () => {
      expect(service.canRetry('critical', 10)).toBe(false);

      expect(service.canRetry('high', 5)).toBe(false);

      expect(service.canRetry('normal', 3)).toBe(false);

      expect(service.canRetry('low', 2)).toBe(false);
    });
  });

  describe('scheduling', () => {
    it('creates a retry timestamp from the calculated delay', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');

      const schedule = service.schedule('critical', 2, now, () => 0);

      expect(schedule.attempt).toBe(2);
      expect(schedule.delayMs).toBe(2_000);
      expect(schedule.retryAt.toISOString()).toBe('2026-01-01T00:00:02.000Z');
    });

    it('rejects scheduling after maximum retries', () => {
      expect(() => service.schedule('low', 2, new Date(), () => 0)).toThrow(
        'Maximum retries reached for low',
      );
    });
  });

  it('exposes the configured default policies', () => {
    expect(DEFAULT_POLICIES.critical.maxRetries).toBe(10);

    expect(DEFAULT_POLICIES.low.maxRetries).toBe(2);
  });
});
