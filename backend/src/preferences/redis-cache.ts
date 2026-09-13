import type Redis from 'ioredis';
import type { PreferenceCache } from './cache.js';
import type { UserPreferences } from './types.js';

export class RedisPreferenceCache implements PreferenceCache {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 3600,
  ) {}

  private key(userId: string): string {
    return `preferences:user:${userId}`;
  }

  async get(userId: string): Promise<UserPreferences | null> {
    const value = await this.redis.get(this.key(userId));
    return value ? (JSON.parse(value) as UserPreferences) : null;
  }

  async set(userId: string, preferences: UserPreferences): Promise<void> {
    await this.redis.set(
      this.key(userId),
      JSON.stringify(preferences),
      'EX',
      this.ttlSeconds,
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }
}
