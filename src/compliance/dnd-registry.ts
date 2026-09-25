import type { DndRegistryEntry } from './types.js';

/** Resolves a user's simulated do-not-disturb registration state. */
export class DndRegistryService {
  private readonly database = new Map<string, DndRegistryEntry>();
  private readonly cache = new Map<string, DndRegistryEntry>();

  constructor() {
    this.database.set('dnd-user-001', {
      userId: 'dnd-user-001',
      phoneNumber: '+15550000001',
      isRegistered: true,
      registeredAt: new Date().toISOString(),
      source: 'simulated-dnd-database',
    });
  }

  seed(entry: DndRegistryEntry): void {
    this.database.set(entry.userId, entry);
    this.cache.delete(entry.userId);
  }

  async lookup(userId: string): Promise<DndRegistryEntry | null> {
    const cached = this.cache.get(userId);

    if (cached) {
      return cached;
    }

    const entry = this.database.get(userId) ?? null;

    if (entry) {
      this.cache.set(userId, entry);
    }

    return entry;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
