import { describe, expect, it } from 'vitest';
import { DndClassificationService } from '../../src/compliance/index.js';

describe('DND classifier', () => {
  const service = new DndClassificationService();

  it.each([
    'transaction.created',
    'payment.failed',
    'security.suspicious_activity',
    'user.password_reset_requested',
    'invoice.generated',
    'account.login',
    'otp.created',
    'refund.completed',
    'shipment.delivered',
    'subscription.payment_failed',
  ])('classifies %s as transactional', (eventType) => {
    expect(service.classify(eventType)).toBe('TRANSACTIONAL');
  });

  it.each([
    'promotion.available',
    'promotion.expiring',
    'marketing.campaign',
    'newsletter.created',
    'offer.available',
  ])('classifies %s as promotional', (eventType) => {
    expect(service.classify(eventType)).toBe('PROMOTIONAL');
  });

  it('supports helper methods', () => {
    expect(service.isTransactional('payment.failed')).toBe(true);

    expect(service.isPromotional('promotion.available')).toBe(true);
  });
});
