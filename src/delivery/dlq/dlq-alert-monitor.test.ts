import { describe, expect, it, vi } from 'vitest';

import { DlqAlertMonitor } from './dlq-alert-monitor.js';

import type { DlqAlertNotifier } from './dlq-alert-monitor.js';

const createQueryBuilder = (count: string) => {
  const builder = {
    whereNot: vi.fn(),
    count: vi.fn(),
    first: vi.fn(),
  };

  builder.whereNot.mockReturnValue(builder);

  builder.count.mockReturnValue(builder);

  builder.first.mockResolvedValue({
    count,
  });

  return builder;
};

describe('DlqAlertMonitor', () => {
  it('returns the configured alert threshold', () => {
    const db = vi.fn();
    const notifier: DlqAlertNotifier = {
      alert: vi.fn(),
    };

    const monitor = new DlqAlertMonitor(db as never, notifier, {
      depthThreshold: 25,
    });

    expect(monitor.getConfig()).toEqual({
      depthThreshold: 25,
    });
  });

  it('returns the number of unresolved DLQ entries', async () => {
    const query = createQueryBuilder('7');

    const db = vi.fn().mockReturnValue(query);

    const notifier: DlqAlertNotifier = {
      alert: vi.fn(),
    };

    const monitor = new DlqAlertMonitor(db as never, notifier);

    const depth = await monitor.getDepth();

    expect(depth).toBe(7);

    expect(db).toHaveBeenCalledWith('dead_letter_queue');

    expect(query.whereNot).toHaveBeenCalledWith('status', 'resolved');
  });

  it('does not alert when depth is at the threshold', async () => {
    const query = createQueryBuilder('10');

    const db = vi.fn().mockReturnValue(query);

    const notifier: DlqAlertNotifier = {
      alert: vi.fn(),
    };

    const monitor = new DlqAlertMonitor(db as never, notifier, {
      depthThreshold: 10,
    });

    const result = await monitor.check(new Date('2026-09-15T12:00:00Z'));

    expect(result).toBeNull();

    expect(notifier.alert).not.toHaveBeenCalled();
  });

  it('alerts operations when depth exceeds threshold', async () => {
    const query = createQueryBuilder('11');

    const db = vi.fn().mockReturnValue(query);

    const notifier: DlqAlertNotifier = {
      alert: vi.fn(),
    };

    const triggeredAt = new Date('2026-09-15T12:00:00Z');

    const monitor = new DlqAlertMonitor(db as never, notifier, {
      depthThreshold: 10,
    });

    const result = await monitor.check(triggeredAt);

    expect(result).toEqual({
      depth: 11,
      threshold: 10,
      message: 'DLQ depth 11 exceeds threshold 10',
      triggeredAt,
    });

    expect(notifier.alert).toHaveBeenCalledTimes(1);

    expect(notifier.alert).toHaveBeenCalledWith(result);
  });
});
