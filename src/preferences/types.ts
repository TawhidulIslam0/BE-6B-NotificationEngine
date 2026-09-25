/** Channels supported by user preference management. */
export const preferenceChannels = [
  'sms',
  'email',
  'push',
  'whatsapp',
  'in-app',
  'ivr',
  'webhook',
] as const;

/** Union of supported preference channel names. */
export type PreferenceChannel = (typeof preferenceChannels)[number];
/** Delivery mode selected for a preference channel. */
export type PreferenceMode = 'immediate' | 'digest' | 'disabled';

/** Enabled state and delivery mode for one channel. */
export interface ChannelPreference {
  enabled: boolean;
  mode: PreferenceMode;
}

/** Complete preference map keyed by supported channel. */
export type ChannelPreferences = Record<PreferenceChannel, ChannelPreference>;

/** Effective notification preferences for a user. */
export interface UserPreferences {
  userId: string;
  locale: 'en' | 'hi' | 'mr' | 'ta' | 'te';
  timezone: string;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  channels: ChannelPreferences;
  categories: Record<string, boolean>;
  segment?: string;
  updatedAt: string;
  source: 'default' | 'segment' | 'user' | 'regulatory';
}

/** Partial preference update accepted by the preferences API. */
export interface PreferencePatch {
  locale?: UserPreferences['locale'];
  timezone?: string;
  quietHours?: UserPreferences['quietHours'];
  channels?: Partial<ChannelPreferences>;
  categories?: Record<string, boolean>;
}

/** Policy override applied above user-configured preferences. */
export interface RegulatoryOverride {
  channels?: Partial<ChannelPreferences>;
  categories?: Record<string, boolean>;
  reason: string;
}
