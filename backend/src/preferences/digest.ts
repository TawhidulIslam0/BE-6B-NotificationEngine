import type { PreferenceChannel } from './types.js';

export interface DigestNotification {
  id: string;
  userId: string;
  channel: PreferenceChannel;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
}

export interface NotificationDigest {
  userId: string;
  channel: PreferenceChannel;
  subject: string;
  body: string;
  notificationIds: string[];
}

export function buildDigest(
  notifications: DigestNotification[],
): NotificationDigest | null {
  if (notifications.length === 0) {
    return null;
  }

  const first = notifications[0];

  if (
    !notifications.every(
      (notification) =>
        notification.userId === first.userId &&
        notification.channel === first.channel,
    )
  ) {
    throw new Error('Digest notifications must share userId and channel');
  }

  const lowPriority = notifications.filter(
    (notification) => notification.priority === 'low',
  );

  if (lowPriority.length === 0) {
    return null;
  }

  return {
    userId: first.userId,
    channel: first.channel,
    subject: `You have ${lowPriority.length} new notifications`,
    body: lowPriority
      .map(
        (notification, index) =>
          `${index + 1}. ${notification.title}: ${notification.body}`,
      )
      .join('\n'),
    notificationIds: lowPriority.map((notification) => notification.id),
  };
}
