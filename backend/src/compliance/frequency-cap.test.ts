import { beforeEach, describe, expect, it } from 'vitest';
import { FrequencyCapService } from './frequency-cap.js';
import type { FrequencyCapRequest } from './types.js';

describe('FrequencyCapService', () => {
  let service: FrequencyCapService;

  const request: FrequencyCapRequest = {
    userId: 'user-1',
    channel: 'sms',
    eventType: 'user.welcome',
    rules: [
      {
        name: 'per-minute',
        limit: 2,
        windowSeconds: 60,
      },
    ],
  };

  beforeEach(async () => {
    service = new FrequencyCapService();
    await service.clear();
  });

  it('allows the first notification', async () => {
    const result = await service.check(request);

    expect(result.allowed).toBe(true);
  });

  it('allows notifications until the limit is reached', async () => {
    expect((await service.check(request)).allowed).toBe(true);
    expect((await service.check(request)).allowed).toBe(true);
  });

  it('blocks notifications after the limit is reached', async () => {
    await service.check(request);
    await service.check(request);

    const result = await service.check(request);

    expect(result.allowed).toBe(false);
    expect(result.exceededRule).toBe('per-minute');
  });

  it('reports the current count', async () => {
    const result = await service.check(request);

    expect(result.counts['per-minute']).toBe(1);
  });

  it('supports multiple frequency rules', async () => {
    const multiRuleRequest: FrequencyCapRequest = {
      ...request,
      rules: [
        {
          name: 'short-window',
          limit: 2,
          windowSeconds: 60,
        },
        {
          name: 'long-window',
          limit: 5,
          windowSeconds: 3600,
        },
      ],
    };

    const result = await service.check(multiRuleRequest);

    expect(result.allowed).toBe(true);
    expect(result.counts).toHaveProperty('short-window');
    expect(result.counts).toHaveProperty('long-window');
  });

  it('blocks when the short window is exceeded', async () => {
    const shortWindowRequest: FrequencyCapRequest = {
      ...request,
      rules: [
        {
          name: 'short-window',
          limit: 1,
          windowSeconds: 60,
        },
      ],
    };

    await service.check(shortWindowRequest);

    const result = await service.check(shortWindowRequest);

    expect(result.allowed).toBe(false);
    expect(result.exceededRule).toBe('short-window');
  });

  it('uses separate counters for different users', async () => {
    const userTwoRequest: FrequencyCapRequest = {
      ...request,
      userId: 'user-2',
    };

    await service.check(request);
    const result = await service.check(userTwoRequest);

    expect(result.allowed).toBe(true);
  });

  it('uses separate counters for different channels', async () => {
    const emailRequest: FrequencyCapRequest = {
      ...request,
      channel: 'email',
    };

    await service.check(request);
    const result = await service.check(emailRequest);

    expect(result.allowed).toBe(true);
  });

  it('uses separate counters for different event types', async () => {
    const differentEventRequest: FrequencyCapRequest = {
      ...request,
      eventType: 'user.password_changed',
    };

    await service.check(request);
    const result = await service.check(differentEventRequest);

    expect(result.allowed).toBe(true);
  });

  it('does not record a notification when a rule is already exceeded', async () => {
    const limitedRequest: FrequencyCapRequest = {
      ...request,
      rules: [
        {
          name: 'per-minute',
          limit: 1,
          windowSeconds: 60,
        },
      ],
    };

    await service.check(limitedRequest);

    const blocked = await service.check(limitedRequest);
    const allowedAfterBlocked = await service.check(limitedRequest);

    expect(blocked.allowed).toBe(false);
    expect(allowedAfterBlocked.allowed).toBe(false);
  });
});