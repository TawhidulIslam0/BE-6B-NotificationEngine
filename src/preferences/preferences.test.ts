import { describe, expect, it } from 'vitest';
import {
  InMemoryPreferenceAnalytics,
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
  PreferenceService,
  buildDigest,
  resolvePreferences,
} from './index.js';

describe('Preference system', () => {
  it('applies defaults on first access', async () => {
    const service = new PreferenceService(
      new InMemoryPreferenceStore(),
      new InMemoryPreferenceCache(),
    );

    const result = await service.get('user-1');

    expect(result.userId).toBe('user-1');
    expect(result.locale).toBe('en');
    expect(result.channels.email.enabled).toBe(true);
  });

  it('resolves defaults, segment, user, and regulatory layers', () => {
    const result = resolvePreferences('user-1', {
      segment: {
        categories: { marketing: true },
      },
      user: {
        locale: 'hi',
        channels: {
          ...resolvePreferences('user-1').channels,
          sms: { enabled: false, mode: 'disabled' },
        },
      },
      regulatory: {
        categories: { security: true },
        reason: 'Required security notification',
      },
    });

    expect(result.locale).toBe('hi');
    expect(result.categories.marketing).toBe(true);
    expect(result.channels.sms.enabled).toBe(false);
    expect(result.source).toBe('regulatory');
  });

  it('invalidates and refreshes cache after update', async () => {
    const store = new InMemoryPreferenceStore();
    const cache = new InMemoryPreferenceCache();
    const service = new PreferenceService(store, cache);

    await service.get('user-2');
    const updated = await service.update('user-2', {
      locale: 'mr',
    });

    expect(updated.locale).toBe('mr');
    expect((await service.get('user-2')).locale).toBe('mr');
  });

  it('builds a low-priority digest', () => {
    const digest = buildDigest([
      {
        id: 'n1',
        userId: 'u1',
        channel: 'email',
        title: 'First',
        body: 'One',
        priority: 'low',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'n2',
        userId: 'u1',
        channel: 'email',
        title: 'Second',
        body: 'Two',
        priority: 'low',
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(digest?.notificationIds).toEqual(['n1', 'n2']);
  });

  it('tracks frequently changed preferences', async () => {
    const analytics = new InMemoryPreferenceAnalytics();

    await analytics.record({
      userId: 'u1',
      field: 'locale',
      previousValue: 'en',
      nextValue: 'hi',
      changedAt: new Date().toISOString(),
    });
    await analytics.record({
      userId: 'u1',
      field: 'locale',
      previousValue: 'hi',
      nextValue: 'mr',
      changedAt: new Date().toISOString(),
    });

    expect(await analytics.mostChanged()).toEqual([
      { field: 'locale', changes: 2 },
    ]);
  });
});
