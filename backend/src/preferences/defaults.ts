import type { ChannelPreferences, UserPreferences } from './types.js';

export const defaultChannelPreferences: ChannelPreferences = {
  sms: { enabled: true, mode: 'immediate' },
  email: { enabled: true, mode: 'immediate' },
  push: { enabled: true, mode: 'immediate' },
  whatsapp: { enabled: false, mode: 'immediate' },
  'in-app': { enabled: true, mode: 'immediate' },
  ivr: { enabled: false, mode: 'immediate' },
  webhook: { enabled: true, mode: 'immediate' },
};

export function createDefaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    locale: 'en',
    timezone: 'UTC',
    channels: structuredClone(defaultChannelPreferences),
    categories: {
      security: true,
      transactional: true,
      marketing: false,
      system: true,
    },
    updatedAt: new Date().toISOString(),
    source: 'default',
  };
}
