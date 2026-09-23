import { describe, expect, it, vi } from 'vitest';

import { ProviderRateLimiter } from './rate-limiter.js';

describe('ProviderRateLimiter', () => {
  it('rejects a non-positive maxRequests value', () => {
    expect(
      () =>
        new ProviderRateLimiter({
          maxRequests: 0,
          windowMs: 1000,
        }),
    ).toThrow('maxRequests must be greater than zero');
  });

  it('rejects a negative maxRequests value', () => {
    expect(
      () =>
        new ProviderRateLimiter({
          maxRequests: -1,
          windowMs: 1000,
        }),
    ).toThrow('maxRequests must be greater than zero');
  });

  it('rejects a non-positive windowMs value', () => {
    expect(
      () =>
        new ProviderRateLimiter({
          maxRequests: 1,
          windowMs: 0,
        }),
    ).toThrow('windowMs must be greater than zero');
  });

  it('rejects a negative windowMs value', () => {
    expect(
      () =>
        new ProviderRateLimiter({
          maxRequests: 1,
          windowMs: -1,
        }),
    ).toThrow('windowMs must be greater than zero');
  });

  it('allows requests while the limit has not been reached', async () => {
    const limiter = new ProviderRateLimiter({
      maxRequests: 2,
      windowMs: 1000,
    });

    await expect(limiter.waitForSlot()).resolves.toBeUndefined();
    await expect(limiter.waitForSlot()).resolves.toBeUndefined();
  });

  it('waits when the request limit is reached', async () => {
    vi.useFakeTimers();

    try {
      const limiter = new ProviderRateLimiter({
        maxRequests: 1,
        windowMs: 1000,
      });

      await limiter.waitForSlot();

      const secondRequest = limiter.waitForSlot();

      await vi.advanceTimersByTimeAsync(999);
      let settled = false;

      void secondRequest.then(() => {
        settled = true;
      });

      await Promise.resolve();

      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await secondRequest;

      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes expired requests before checking the limit', async () => {
    vi.useFakeTimers();

    try {
      const limiter = new ProviderRateLimiter({
        maxRequests: 1,
        windowMs: 1000,
      });

      await limiter.waitForSlot();

      await vi.advanceTimersByTimeAsync(1001);

      await expect(limiter.waitForSlot()).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows a request immediately when the oldest request is exactly at the window boundary', async () => {
    vi.useFakeTimers();

    try {
      const limiter = new ProviderRateLimiter({
        maxRequests: 1,
        windowMs: 1000,
      });

      await limiter.waitForSlot();

      await vi.advanceTimersByTimeAsync(1000);

      await expect(limiter.waitForSlot()).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles the empty oldest-request guard safely', async () => {
    const limiter = new ProviderRateLimiter({
      maxRequests: 1,
      windowMs: 1000,
    });

    await expect(limiter.waitForSlot()).resolves.toBeUndefined();
  });
});
