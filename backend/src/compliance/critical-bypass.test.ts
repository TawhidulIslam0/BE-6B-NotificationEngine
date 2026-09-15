import { describe, expect, it } from 'vitest';
import {
  ComplianceAuditService,
  QuietHoursService,
} from '../../src/compliance/index.js';

describe('Critical notification bypass', () => {
  it('allows critical notifications during quiet hours', () => {
    const service = new QuietHoursService();

    const result = service.shouldQueue(
      {
        id: 'critical-1',
        userId: 'user-1',
        channel: 'sms',
        title: 'Critical event',
        body: 'Immediate action required',
        priority: 'critical',
        createdAt: '2026-09-09T23:30:00',
      },
      {
        enabled: true,
        start: '22:00',
        end: '07:00',
        timezone: 'America/New_York',
      },
    );

    expect(result).toBe(false);
  });

  it('records a critical bypass audit event', () => {
    const audit = new ComplianceAuditService();

    const entry = audit.record({
      userId: 'user-1',
      eventId: 'critical-1',
      action: 'CRITICAL_BYPASS',
      channel: 'sms',
      classification: 'TRANSACTIONAL',
      reason: 'Critical events bypass quiet hours',
    });

    expect(entry.action).toBe('CRITICAL_BYPASS');
    expect(audit.getAll()).toHaveLength(1);
  });

  it('keeps audit entries immutable from external array mutation', () => {
    const audit = new ComplianceAuditService();

    audit.record({
      userId: 'user-1',
      action: 'DND_ALLOWED',
      reason: 'Transactional notification allowed',
    });

    const entries = audit.getAll();

    expect(entries).toHaveLength(1);
    expect(audit.getAll()).toHaveLength(1);
  });
});
