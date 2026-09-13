import {
  buildDigest,
  type DigestNotification,
  type NotificationDigest,
} from './digest.js';
import type { PreferenceChannel } from './types.js';

export interface DigestBatchStore {
  add(notification: DigestNotification): Promise<void>;

  get(
    userId: string,
    channel: PreferenceChannel,
  ): Promise<DigestNotification[]>;

  remove(
    userId: string,
    channel: PreferenceChannel,
  ): Promise<void>;
}

export class InMemoryDigestBatchStore implements DigestBatchStore {
  private readonly batches = new Map<
    string,
    DigestNotification[]
  >();

  private key(
    userId: string,
    channel: PreferenceChannel,
  ): string {
    return `${userId}:${channel}`;
  }

  async add(notification: DigestNotification): Promise<void> {
    const key = this.key(
      notification.userId,
      notification.channel,
    );

    const existing = this.batches.get(key) ?? [];

    existing.push(notification);
    this.batches.set(key, existing);
  }

  async get(
    userId: string,
    channel: PreferenceChannel,
  ): Promise<DigestNotification[]> {
    return [
      ...(this.batches.get(this.key(userId, channel)) ?? []),
    ];
  }

  async remove(
    userId: string,
    channel: PreferenceChannel,
  ): Promise<void> {
    this.batches.delete(this.key(userId, channel));
  }
}

export class DigestService {
  constructor(
    private readonly store: DigestBatchStore,
  ) {}

  async add(
    notification: DigestNotification,
  ): Promise<void> {
    if (notification.priority !== 'low') {
      throw new Error(
        'Only low-priority notifications can be added to a digest',
      );
    }

    await this.store.add(notification);
  }

  async flush(
    userId: string,
    channel: PreferenceChannel,
  ): Promise<NotificationDigest | null> {
    const notifications = await this.store.get(
      userId,
      channel,
    );

    if (notifications.length === 0) {
      return null;
    }

    const digest = buildDigest(notifications);

    if (digest) {
      await this.store.remove(userId, channel);
    }

    return digest;
  }
}