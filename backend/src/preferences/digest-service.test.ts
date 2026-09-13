import { describe, expect, it } from 'vitest';
import {
  DigestService,
  InMemoryDigestBatchStore,
} from './digest-service.js';

function notification(
  id: string,
  userId = 'user-1',
) {
  return {
    id,
    userId,
    channel: 'email' as const,
    title: `Notification ${id}`,
    body: `Body ${id}`,
    priority: 'low' as const,
    createdAt: new Date().toISOString(),
  };
}

describe('DigestService', () => {
  it('adds low-priority notifications to a batch', async () => {
    const service = new DigestService(
      new InMemoryDigestBatchStore(),
    );

    await service.add(notification('n1'));
    await service.add(notification('n2'));

    const digest = await service.flush(
      'user-1',
      'email',
    );

    expect(digest?.notificationIds).toEqual(['n1', 'n2']);
    expect(digest?.userId).toBe('user-1');
    expect(digest?.channel).toBe('email');
  });

  it('rejects non-low-priority notifications', async () => {
    const service = new DigestService(
      new InMemoryDigestBatchStore(),
    );

    await expect(
      service.add({
        ...notification('n1'),
        priority: 'normal',
      }),
    ).rejects.toThrow(
      'Only low-priority notifications can be added to a digest',
    );
  });

  it('returns null when no notifications are queued', async () => {
    const service = new DigestService(
      new InMemoryDigestBatchStore(),
    );

    const digest = await service.flush(
      'user-1',
      'email',
    );

    expect(digest).toBeNull();
  });

  it('clears a batch after a successful flush', async () => {
    const service = new DigestService(
      new InMemoryDigestBatchStore(),
    );

    await service.add(notification('n1'));

    const firstDigest = await service.flush(
      'user-1',
      'email',
    );

    const secondDigest = await service.flush(
      'user-1',
      'email',
    );

    expect(firstDigest?.notificationIds).toEqual(['n1']);
    expect(secondDigest).toBeNull();
  });

  it('keeps separate batches for different users', async () => {
    const service = new DigestService(
      new InMemoryDigestBatchStore(),
    );

    await service.add(notification('n1', 'user-1'));
    await service.add(notification('n2', 'user-2'));

    const firstDigest = await service.flush(
      'user-1',
      'email',
    );

    const secondDigest = await service.flush(
      'user-2',
      'email',
    );

    expect(firstDigest?.notificationIds).toEqual(['n1']);
    expect(secondDigest?.notificationIds).toEqual(['n2']);
  });
});