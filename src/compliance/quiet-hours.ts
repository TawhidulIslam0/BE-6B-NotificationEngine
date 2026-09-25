import type {
  QuietHours,
  QuietHoursNotification,
  QuietHoursResult,
} from './types.js';

/** Digest payload released when a user's quiet hours end. */
export interface MorningDigest {
  userId: string;
  channel: QuietHoursNotification['channel'];
  title: string;
  body: string;
  notificationIds: string[];
  createdAt: string;
  priority: QuietHoursNotification['priority'];
}

/** Evaluates timezone-aware quiet-hour windows for notifications. */
export class QuietHoursService {
  isWithinQuietHours(date: Date, quietHours: QuietHours): QuietHoursResult {
    if (!quietHours.enabled) {
      return { quiet: false };
    }

    const current = this.getMinutesInTimezone(date, quietHours.timezone);

    const start = this.toMinutes(quietHours.start);
    const end = this.toMinutes(quietHours.end);

    const overnight = start > end;

    const quiet = overnight
      ? current >= start || current < end
      : current >= start && current < end;

    return { quiet };
  }

  shouldQueue(
    notification: QuietHoursNotification,
    quietHours: QuietHours,
  ): boolean {
    if (notification.priority === 'critical') {
      return false;
    }

    return this.isWithinQuietHours(new Date(notification.createdAt), quietHours)
      .quiet;
  }

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new Error(`Invalid time format: ${value}`);
    }

    return hours * 60 + minutes;
  }

  private getMinutesInTimezone(date: Date, timezone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });

      const parts = formatter.formatToParts(date);

      const hour = Number(parts.find((part) => part.type === 'hour')?.value);

      const minute = Number(
        parts.find((part) => part.type === 'minute')?.value,
      );

      if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        throw new Error('Unable to resolve local time');
      }

      return hour * 60 + minute;
    } catch {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
  }
}

/** Stores notifications deferred until a quiet-hour window ends. */
export class QuietHoursQueue {
  private readonly queue = new Map<string, QuietHoursNotification[]>();

  add(notification: QuietHoursNotification): void {
    const existing = this.queue.get(notification.userId) ?? [];

    existing.push(notification);
    this.queue.set(notification.userId, existing);
  }

  flush(userId: string): QuietHoursNotification[] {
    const notifications = this.queue.get(userId) ?? [];

    this.queue.delete(userId);

    return [...notifications];
  }

  size(userId: string): number {
    return this.queue.get(userId)?.length ?? 0;
  }

  createMorningDigest(userId: string): MorningDigest | undefined {
    const notifications = this.flush(userId);

    if (notifications.length === 0) {
      return undefined;
    }

    const first = notifications[0];

    return {
      userId,
      channel: first.channel,
      title: `Your morning notification digest (${notifications.length})`,
      body: notifications
        .map(
          (notification, index) =>
            `${index + 1}. ${notification.title}: ${notification.body}`,
        )
        .join('\n'),
      notificationIds: notifications.map((notification) => notification.id),
      createdAt: new Date().toISOString(),
      priority: notifications.some(
        (notification) => notification.priority === 'high',
      )
        ? 'high'
        : 'normal',
    };
  }
}
