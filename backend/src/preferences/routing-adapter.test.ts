import { describe, expect, it } from 'vitest';
import {
  isWithinQuietHours,
  PreferenceRoutingAdapter,
} from './routing-adapter.js';
import { createDefaultPreferences } from './defaults.js';
import type { UserPreferences } from './types.js';
import type { EventEnvelope } from '../events/types/events.js';
import type {
  EventRouter,
  RoutingDecision,
} from '../events/routing/event-router.js';

const event: EventEnvelope<'promotion.available'> = {
  event_id: 'event-1',
  event_type: 'promotion.available',
  event_version: '1.0',
  occurred_at: new Date().toISOString(),
  user_id: 'user-1',
  correlation_id: 'correlation-1',
  source: 'test',
  priority: 'normal',
  payload: {
    promotionId: 'promo-1',
    title: 'Special promotion',
  },
};

function createPreferences(): UserPreferences {
  const preferences = createDefaultPreferences('user-1');

  return {
    ...preferences,
    channels: {
      ...preferences.channels,
      sms: {
        enabled: false,
        mode: 'disabled',
      },
      email: {
        enabled: true,
        mode: 'immediate',
      },
      push: {
        enabled: true,
        mode: 'digest',
      },
      whatsapp: {
        enabled: false,
        mode: 'disabled',
      },
      'in-app': {
        enabled: false,
        mode: 'disabled',
      },
      ivr: {
        enabled: false,
        mode: 'disabled',
      },
      webhook: {
        enabled: false,
        mode: 'disabled',
      },
    },
  };
}

function createTestRouter(
  capture: (preferences: unknown[]) => void,
): EventRouter {
  return {
    route: (
      _eventType: string,
      _priority: 'low' | 'normal' | 'high' | 'critical',
      preferences: unknown[],
    ): RoutingDecision => {
      capture(preferences);

      return {
        channels: [],
        reason: 'user-preference',
      };
    },
  } as EventRouter;
}

describe('PreferenceRoutingAdapter', () => {
  it('passes only immediate channels to the router', () => {
    let receivedPreferences: unknown[] = [];

    const router = createTestRouter((preferences) => {
      receivedPreferences = preferences;
    });

    const adapter = new PreferenceRoutingAdapter(router);
    adapter.route(event, createPreferences());

    expect(receivedPreferences).toHaveLength(1);
    expect(receivedPreferences[0]).toMatchObject({
      channel: 'email',
      enabled: true,
    });
  });

  it('excludes disabled channels', () => {
    let receivedPreferences: unknown[] = [];

    const preferences = createPreferences();

    preferences.channels.email = {
      enabled: false,
      mode: 'disabled',
    };

    const router = createTestRouter((received) => {
      receivedPreferences = received;
    });

    const adapter = new PreferenceRoutingAdapter(router);
    adapter.route(event, preferences);

    expect(receivedPreferences).toHaveLength(0);
  });

  it('preserves digest configuration for later digest processing', () => {
    const preferences = createPreferences();

    expect(preferences.channels.push).toEqual({
      enabled: true,
      mode: 'digest',
    });
  });

  it('detects quiet hours during a daytime window', () => {
    const preferences = createPreferences();

    preferences.timezone = 'America/New_York';
    preferences.quietHours = {
      enabled: true,
      start: '09:00',
      end: '17:00',
    };

    const now = new Date('2026-09-13T16:00:00.000Z');

    expect(isWithinQuietHours(preferences, now)).toBe(true);
  });

  it('detects overnight quiet hours', () => {
    const preferences = createPreferences();

    preferences.timezone = 'America/New_York';
    preferences.quietHours = {
      enabled: true,
      start: '22:00',
      end: '07:00',
    };

    const now = new Date('2026-09-14T03:00:00.000Z');

    expect(isWithinQuietHours(preferences, now)).toBe(true);
  });

  it('does not enforce disabled quiet hours', () => {
    const preferences = createPreferences();

    preferences.quietHours = {
      enabled: false,
      start: '09:00',
      end: '17:00',
    };

    const now = new Date('2026-09-13T16:00:00.000Z');

    expect(isWithinQuietHours(preferences, now)).toBe(false);
  });

  it('suppresses normal notifications during quiet hours', () => {
    const preferences = createPreferences();

    preferences.timezone = 'America/New_York';
    preferences.quietHours = {
      enabled: true,
      start: '09:00',
      end: '17:00',
    };

    const adapter = new PreferenceRoutingAdapter(
      createTestRouter(() => {}),
      () => new Date('2026-09-13T16:00:00.000Z'),
    );

    const result = adapter.route(event, preferences);

    expect(result.channels).toEqual([]);
  });

  it('allows critical notifications during quiet hours', () => {
    const preferences = createPreferences();

    preferences.timezone = 'America/New_York';
    preferences.quietHours = {
      enabled: true,
      start: '09:00',
      end: '17:00',
    };

    const criticalEvent: EventEnvelope<'promotion.available'> = {
      ...event,
      priority: 'critical',
    };

    const adapter = new PreferenceRoutingAdapter(
      createTestRouter(() => {}),
      () => new Date('2026-09-13T16:00:00.000Z'),
    );

    const result = adapter.route(
      criticalEvent,
      preferences,
    );

    expect(result.channels).toEqual([]);
  });
});