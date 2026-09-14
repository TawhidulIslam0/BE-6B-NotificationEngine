import type { ComplianceAuditEntry } from './types.js';

export class ComplianceAuditService {
  private readonly entries: ComplianceAuditEntry[] = [];

  record(
    entry: Omit<
      ComplianceAuditEntry,
      'id' | 'recordedAt'
    >,
  ): ComplianceAuditEntry {
    const auditEntry: ComplianceAuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
    };

    this.entries.push(auditEntry);

    return auditEntry;
  }

  getAll(): readonly ComplianceAuditEntry[] {
    return [...this.entries];
  }

  findByUser(userId: string): ComplianceAuditEntry[] {
    return this.entries.filter(
      (entry) => entry.userId === userId,
    );
  }
}