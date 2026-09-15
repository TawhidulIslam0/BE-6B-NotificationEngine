import { describe, expect, it } from 'vitest';
import {
  QuietHoursQueue,
  QuietHoursService,
} from '../../src/compliance/index.js';

describe('Quiet hours service', () => {
  const service = new QuietHoursService();

  const quietHours = {
    enabled: true,
    start: '22:00',
    end: '07:00',
    timezone: 'America/New_York',
  };

  it('detects overnight quiet hours', () => {
    const date = new Date('2026-09-09T23:00:00');

    expect(service.isWithinQuietHours(date, quietHours).quiet).toBe(true);
  });

  it('detects morning outside quiet hours', () => {
    const date = new Date('2026-09-09T10:00:00');

    expect(service.isWithinQuietHours(date, quietHours).quiet).toBe(false);
  });

  it('detects the exact start boundary', () => {
    const date = new Date('2026-09-09T22:00:00');

    expect(service.isWithinQuietHours(date, quietHours).quiet).toBe(true);
  });

  it('detects the exact end boundary', () => {
    const date = new Date('2026-09-09T07:00:00');

    expect(service.isWithinQuietHours(date, quietHours).quiet).toBe(false);
  });

  it('does not enforce disabled quiet hours', () => {
    const date = new Date('2026-09-09T23:00:00');

    expect(
      service.isWithinQuietHours(date, {
        ...quietHours,
        enabled: false,
      }).quiet,
    ).toBe(false);
  });

  it('does not queue critical notifications', () => {
    expect(
      service.shouldQueue(
        {
          id: '1',
          userId: 'user-1',
          channel: 'sms',
          title: 'Critical',
          body: 'Critical event',
          priority: 'critical',
          createdAt: '2026-09-09T23:00:00',
        },
        quietHours,
      ),
    ).toBe(false);
  });

  it('queues normal notifications during quiet hours', () => {
    expect(
      service.shouldQueue(
        {
          id: '1',
          userId: 'user-1',
          channel: 'sms',
          title: 'Normal',
          body: 'Normal event',
          priority: 'normal',
          createdAt: '2026-09-09T23:00:00',
        },
        quietHours,
      ),
    ).toBe(true);
  });
});

describe('Quiet hours queue', () => {
  it('adds and flushes notifications', () => {
    const queue = new QuietHoursQueue();

    queue.add({
      id: '1',
      userId: 'user-1',
      channel: 'sms',
      title: 'Test',
      body: 'Test body',
      priority: 'normal',
      createdAt: new Date().toISOString(),
    });

    expect(queue.size('user-1')).toBe(1);
    expect(queue.flush('user-1')).toHaveLength(1);
    expect(queue.size('user-1')).toBe(0);
  });

  it('returns an empty array for an unknown user', () => {
    const queue = new QuietHoursQueue();

    expect(queue.flush('missing')).toEqual([]);
  });
});
