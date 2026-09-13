import { createDefaultPreferences } from './defaults.js';
import type {
  PreferencePatch,
  RegulatoryOverride,
  UserPreferences,
} from './types.js';
import { resolvePreferences } from './resolver.js';
import type { PreferenceCache } from './cache.js';
import type { PreferenceStore } from './store.js';

const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te'] as const;

function validatePatch(patch: PreferencePatch): void {
  if (patch.locale !== undefined && !supportedLocales.includes(patch.locale)) {
    throw new Error(`Unsupported locale: ${patch.locale}`);
  }
}

export class PreferenceService {
  constructor(
    private readonly store: PreferenceStore,
    private readonly cache: PreferenceCache,
  ) {}

  async get(
    userId: string,
    segment?: Partial<UserPreferences>,
    regulatory?: RegulatoryOverride,
  ): Promise<UserPreferences> {
    const cached = await this.cache.get(userId);

    if (cached && !segment && !regulatory) {
      return cached;
    }

    let user = await this.store.findByUserId(userId);

    if (!user) {
      user = createDefaultPreferences(userId);
      await this.store.insertDefaults(user);
    }

    const resolved = resolvePreferences(userId, {
      user,
      segment,
      regulatory,
    });

    if (!segment && !regulatory) {
      await this.cache.set(userId, resolved);
    }

    return resolved;
  }

  async update(
    userId: string,
    patch: PreferencePatch,
  ): Promise<UserPreferences> {
    validatePatch(patch);

    const existing = await this.store.findByUserId(userId);

    if (!existing) {
      await this.store.insertDefaults(createDefaultPreferences(userId));
    }

    const updated = await this.store.update(userId, patch);

    await this.cache.invalidate(userId);
    await this.cache.set(userId, updated);

    return updated;
  }
}
