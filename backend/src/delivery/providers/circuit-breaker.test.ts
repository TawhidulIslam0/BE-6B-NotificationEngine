import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('rejects a non-positive failure threshold', () => {
    expect(
      () =>
        new CircuitBreaker({
          failureThreshold: 0,
          resetTimeoutMs: 1000,
        }),
    ).toThrow('failureThreshold must be greater than zero');
  });

  it('rejects a negative failure threshold', () => {
    expect(
      () =>
        new CircuitBreaker({
          failureThreshold: -1,
          resetTimeoutMs: 1000,
        }),
    ).toThrow('failureThreshold must be greater than zero');
  });

  it('rejects a non-positive reset timeout', () => {
    expect(
      () =>
        new CircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 0,
        }),
    ).toThrow('resetTimeoutMs must be greater than zero');
  });

  it('rejects a negative reset timeout', () => {
    expect(
      () =>
        new CircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: -1,
        }),
    ).toThrow('resetTimeoutMs must be greater than zero');
  });

  it('starts in the CLOSED state', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    expect(breaker.getState()).toBe('CLOSED');
  });

  it('returns the operation result when execution succeeds', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const operation = vi.fn().mockResolvedValue('success');

    await expect(breaker.execute(operation)).resolves.toBe('success');

    expect(operation).toHaveBeenCalledOnce();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('propagates operation errors', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const error = new Error('operation failed');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(breaker.execute(operation)).rejects.toThrow(
      'operation failed',
    );

    expect(operation).toHaveBeenCalledOnce();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after reaching the failure threshold', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const operation = vi.fn().mockRejectedValue(new Error('failure'));

    await expect(breaker.execute(operation)).rejects.toThrow('failure');
    expect(breaker.getState()).toBe('CLOSED');

    await expect(breaker.execute(operation)).rejects.toThrow('failure');
    expect(breaker.getState()).toBe('OPEN');
  });

  it('rejects operations while OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
    });

    const operation = vi.fn().mockRejectedValue(new Error('failure'));

    await expect(breaker.execute(operation)).rejects.toThrow('failure');
    expect(breaker.getState()).toBe('OPEN');

    await expect(breaker.execute(operation)).rejects.toThrow(
      'Circuit breaker is open',
    );

    expect(operation).toHaveBeenCalledOnce();
  });

  it('transitions from OPEN to HALF_OPEN after the reset timeout', async () => {
    vi.useFakeTimers();

    try {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });

      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(breaker.execute(operation)).rejects.toThrow('failure');
      expect(breaker.getState()).toBe('OPEN');

      await vi.advanceTimersByTimeAsync(1000);

      expect(breaker.getState()).toBe('HALF_OPEN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes again after a successful HALF_OPEN operation', async () => {
    vi.useFakeTimers();

    try {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });

      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'failure',
      );

      await vi.advanceTimersByTimeAsync(1000);

      expect(breaker.getState()).toBe('HALF_OPEN');

      const successfulOperation = vi.fn().mockResolvedValue('recovered');

      await expect(breaker.execute(successfulOperation)).resolves.toBe(
        'recovered',
      );

      expect(successfulOperation).toHaveBeenCalledOnce();
      expect(breaker.getState()).toBe('CLOSED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reopens after a failed HALF_OPEN operation', async () => {
    vi.useFakeTimers();

    try {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });

      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'failure',
      );

      await vi.advanceTimersByTimeAsync(1000);

      expect(breaker.getState()).toBe('HALF_OPEN');

      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'failure',
      );

      expect(breaker.getState()).toBe('OPEN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets the failure count after a successful operation', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const failingOperation = vi.fn().mockRejectedValue(new Error('failure'));

    const successfulOperation = vi.fn().mockResolvedValue('success');

    await expect(breaker.execute(failingOperation)).rejects.toThrow('failure');

    await expect(breaker.execute(successfulOperation)).resolves.toBe('success');

    await expect(breaker.execute(failingOperation)).rejects.toThrow('failure');

    expect(breaker.getState()).toBe('CLOSED');

    await expect(breaker.execute(failingOperation)).rejects.toThrow('failure');

    expect(breaker.getState()).toBe('OPEN');
  });

  it('does not open before the failure threshold is reached', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });

    const operation = vi.fn().mockRejectedValue(new Error('failure'));

    await expect(breaker.execute(operation)).rejects.toThrow('failure');
    await expect(breaker.execute(operation)).rejects.toThrow('failure');

    expect(breaker.getState()).toBe('CLOSED');
  });

  it('transitions to HALF_OPEN exactly at the reset timeout boundary', async () => {
    vi.useFakeTimers();

    try {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });

      const operation = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(breaker.execute(operation)).rejects.toThrow('failure');

      await vi.advanceTimersByTimeAsync(999);

      expect(breaker.getState()).toBe('OPEN');

      await vi.advanceTimersByTimeAsync(1);

      expect(breaker.getState()).toBe('HALF_OPEN');
    } finally {
      vi.useRealTimers();
    }
  });
});
