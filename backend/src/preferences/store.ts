import type { PreferencePatch, UserPreferences } from './types.js';

export interface PreferenceStore {
  findByUserId(userId: string): Promise<UserPreferences | null>;
  insertDefaults(preferences: UserPreferences): Promise<void>;
  update(userId: string, patch: PreferencePatch): Promise<UserPreferences>;
}

export class InMemoryPreferenceStore implements PreferenceStore {
  private readonly values = new Map<string, UserPreferences>();

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    return this.values.get(userId) ?? null;
  }

  async insertDefaults(preferences: UserPreferences): Promise<void> {
    this.values.set(preferences.userId, preferences);
  }

  async update(
    userId: string,
    patch: PreferencePatch,
  ): Promise<UserPreferences> {
    const existing = this.values.get(userId);

    if (!existing) {
      throw new Error(`User preferences not found: ${userId}`);
    }

    const updated: UserPreferences = {
      ...existing,
      ...patch,
      channels: {
        ...existing.channels,
        ...(patch.channels ?? {}),
      },
      categories: {
        ...existing.categories,
        ...(patch.categories ?? {}),
      },
      updatedAt: new Date().toISOString(),
      source: 'user',
    };

    this.values.set(userId, updated);
    return updated;
  }
}
