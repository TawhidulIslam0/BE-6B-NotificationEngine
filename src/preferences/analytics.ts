/** Audit record for a user preference change. */
export interface PreferenceChange {
  userId: string;
  field: string;
  previousValue: unknown;
  nextValue: unknown;
  changedAt: string;
}

/** Persistence contract for preference-change analytics. */
export interface PreferenceAnalytics {
  record(change: PreferenceChange): Promise<void>;
  mostChanged(
    limit?: number,
  ): Promise<Array<{ field: string; changes: number }>>;
}

/** In-memory recorder for preference-change analytics. */
export class InMemoryPreferenceAnalytics implements PreferenceAnalytics {
  private readonly changes: PreferenceChange[] = [];

  async record(change: PreferenceChange): Promise<void> {
    this.changes.push(change);
  }

  async mostChanged(
    limit = 10,
  ): Promise<Array<{ field: string; changes: number }>> {
    const counts = new Map<string, number>();

    for (const change of this.changes) {
      counts.set(change.field, (counts.get(change.field) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([field, changes]) => ({ field, changes }))
      .sort((a, b) => b.changes - a.changes)
      .slice(0, limit);
  }
}
