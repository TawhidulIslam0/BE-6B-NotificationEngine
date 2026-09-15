import { describe, expect, it } from 'vitest';
import { ConsentService } from '../../src/compliance/index.js';

describe('Consent service', () => {
  it('records opt-in consent', () => {
    const service = new ConsentService();

    const record = service.record('user-1', 'sms', 'OPTED_IN');

    expect(record.status).toBe('OPTED_IN');
    expect(service.hasConsent('user-1', 'sms')).toBe(true);
  });

  it('records opt-out consent', () => {
    const service = new ConsentService();

    service.record('user-1', 'sms', 'OPTED_OUT');

    expect(service.hasConsent('user-1', 'sms')).toBe(false);
  });

  it('supports separate channels', () => {
    const service = new ConsentService();

    service.record('user-1', 'sms', 'OPTED_IN');
    service.record('user-1', 'email', 'OPTED_OUT');

    expect(service.hasConsent('user-1', 'sms')).toBe(true);
    expect(service.hasConsent('user-1', 'email')).toBe(false);
  });

  it('keeps an immutable audit history', () => {
    const service = new ConsentService();

    service.record('user-1', 'sms', 'OPTED_IN');
    service.record('user-1', 'sms', 'OPTED_OUT');

    expect(service.getAuditLog()).toHaveLength(2);
  });

  it('returns undefined for missing consent', () => {
    const service = new ConsentService();

    expect(service.get('missing', 'sms')).toBeUndefined();
  });
});
