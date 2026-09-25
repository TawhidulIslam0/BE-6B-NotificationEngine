import { describe, expect, it, vi } from 'vitest';

import { DeliveryAcknowledgementTracker } from './delivery-acknowledgement-tracker.js';

describe('DeliveryAcknowledgementTracker', () => {
  it('stores provider callbacks', () => {
    const tracker = new DeliveryAcknowledgementTracker();

    const callback = vi.fn();

    tracker.registerCallback(callback);

    tracker.updateStatus(
      'notification-001',
      'sms',
      'Twilio',
      'twilio-001',
      'delivered',
    );

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'notification-001',
        channel: 'sms',
        provider: 'Twilio',
        externalId: 'twilio-001',
        status: 'delivered',
      }),
    );
  });

  it('tracks the latest acknowledgement', () => {
    const tracker = new DeliveryAcknowledgementTracker();

    tracker.updateStatus(
      'notification-001',
      'sms',
      'Twilio',
      'twilio-001',
      'accepted',
    );

    tracker.updateStatus(
      'notification-001',
      'sms',
      'Twilio',
      'twilio-001',
      'delivered',
    );

    expect(tracker.get('notification-001', 'sms')?.status).toBe('delivered');
  });
});
