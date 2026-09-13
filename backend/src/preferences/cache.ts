import type { UserPreferences } from './types.js';

export interface PreferenceCache {
  get(userId: string): Promise<UserPreferences | null>;
  set(userId: string, preferences: UserPreferences): Promise<void>;
  invalidate(userId: string): Promise<void>;
}

export class InMemoryPreferenceCache implements PreferenceCache {
  private readonly values = new Map<string, UserPreferences>();

  async get(userId: string): Promise<UserPreferences | null> {
    return this.values.get(userId) ?? null;
  }

  async set(userId: string, preferences: UserPreferences): Promise<void> {
    this.values.set(userId, preferences);
  }

  async invalidate(userId: string): Promise<void> {
    this.values.delete(userId);
  }
}
