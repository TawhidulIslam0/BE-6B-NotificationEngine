export const preferenceChannels = [
  'sms',
  'email',
  'push',
  'whatsapp',
  'in-app',
  'ivr',
  'webhook',
] as const;

export type PreferenceChannel = (typeof preferenceChannels)[number];
export type PreferenceMode = 'immediate' | 'digest' | 'disabled';

export interface ChannelPreference {
  enabled: boolean;
  mode: PreferenceMode;
}

export type ChannelPreferences = Record<PreferenceChannel, ChannelPreference>;

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

export interface PreferencePatch {
  locale?: UserPreferences['locale'];
  timezone?: string;
  quietHours?: UserPreferences['quietHours'];
  channels?: Partial<ChannelPreferences>;
  categories?: Record<string, boolean>;
}

export interface RegulatoryOverride {
  channels?: Partial<ChannelPreferences>;
  categories?: Record<string, boolean>;
  reason: string;
}
