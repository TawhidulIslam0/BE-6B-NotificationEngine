import type { DndClassification } from './types.js';

const transactionalPatterns = [
  'transaction',
  'payment',
  'invoice',
  'receipt',
  'security',
  'password',
  'login',
  'account',
  'otp',
  'refund',
  'delivery',
  'shipment',
  'subscription.payment_failed',
];

export class DndClassificationService {
  classify(eventType: string): DndClassification {
    const normalized = eventType.toLowerCase();

    if (transactionalPatterns.some((pattern) => normalized.includes(pattern))) {
      return 'TRANSACTIONAL';
    }

    return 'PROMOTIONAL';
  }

  isTransactional(eventType: string): boolean {
    return this.classify(eventType) === 'TRANSACTIONAL';
  }

  isPromotional(eventType: string): boolean {
    return this.classify(eventType) === 'PROMOTIONAL';
  }
}
