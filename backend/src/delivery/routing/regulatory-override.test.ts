import { describe, expect, it } from 'vitest';
import { RegulatoryOverride } from './regulatory-override.js';

describe('RegulatoryOverride', () => {
  it('detects regulatory events', () => {
    const override = new RegulatoryOverride();

    expect(override.isRegulatory('REGX-001')).toBe(true);

    expect(override.isRegulatory('TXNX-001')).toBe(false);
  });

  it('returns mandatory regulatory channels', () => {
    const override = new RegulatoryOverride();

    expect(override.getRequiredChannels('REGX-001')).toEqual([
      'sms',
      'email',
      'push',
    ]);
  });

  it('selects a required channel available to the system', () => {
    const override = new RegulatoryOverride();

    expect(override.resolve('REGX-001', ['email', 'push'])).toBe('email');
  });

  it('returns null when no regulatory requirement exists', () => {
    const override = new RegulatoryOverride();

    expect(override.resolve('TXNX-001', ['sms', 'email'])).toBeNull();
  });

  it('returns null when no mandatory channel is available', () => {
    const override = new RegulatoryOverride();

    expect(override.resolve('REGX-003', ['sms', 'push'])).toBeNull();
  });

  it('supports custom regulatory requirements', () => {
    const override = new RegulatoryOverride([
      {
        eventType: 'CUSTOM-001',
        requiredChannels: ['whatsapp'],
      },
    ]);

    expect(override.resolve('CUSTOM-001', ['whatsapp'])).toBe('whatsapp');
  });
});
