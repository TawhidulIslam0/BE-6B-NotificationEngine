import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  const createBreaker = () =>
    new CircuitBreaker({
      provider: 'MSG91',
      thresholds: {
        failureRateThreshold: 0.5,
        responseTimeThresholdMs: 1000,
        minimumRequests: 4,
        openStateDurationMs: 100,
      },
    });

  it('starts CLOSED', () => {
    expect(createBreaker().getState()).toBe('CLOSED');
  });

  it('opens when failure rate exceeds threshold', () => {
    const breaker = createBreaker();

    breaker.recordFailure(100);
    breaker.recordFailure(100);
    breaker.recordSuccess(100);
    breaker.recordFailure(100);

    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('opens when response time exceeds threshold', () => {
    const breaker = createBreaker();

    breaker.recordSuccess(1500);
    breaker.recordSuccess(1500);
    breaker.recordSuccess(1500);
    breaker.recordSuccess(1500);

    expect(breaker.getState()).toBe('OPEN');
  });

  it('transitions OPEN to HALF-OPEN after recovery timeout', async () => {
    const breaker = createBreaker();

    breaker.recordFailure(100);
    breaker.recordFailure(100);
    breaker.recordFailure(100);
    breaker.recordFailure(100);

    expect(breaker.getState()).toBe('OPEN');

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(breaker.getState()).toBe('HALF-OPEN');
  });

  it('returns HALF-OPEN to CLOSED after successful probe', async () => {
    const breaker = createBreaker();

    breaker.recordFailure(100);
    breaker.recordFailure(100);
    breaker.recordFailure(100);
    breaker.recordFailure(100);

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(breaker.getState()).toBe('HALF-OPEN');

    breaker.recordSuccess(100);

    expect(breaker.getState()).toBe('CLOSED');
  });
});
