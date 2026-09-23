import { describe, expect, it } from 'vitest';
import { createEvent } from '../../src/events/factory/event-factory.js';
import {
  deserializeEvent,
  serializeEvent,
} from '../../src/events/serialization/event-serializer.js';
import { IngestionPipeline } from '../../src/events/consumer/ingestion-pipeline.js';
import type { EnrichedEvent } from '../../src/events/enrichment/event-enricher.js';
import { EventRouter } from '../../src/events/routing/event-router.js';
import { DeliveryAcknowledgementTracker } from '../../src/delivery/acknowledgement/delivery-acknowledgement-tracker.js';
import { MultiChannelDispatcher } from '../../src/delivery/failover/multi-channel-dispatcher.js';
import {
  IdempotencyStore,
  ProviderFailover,
} from '../../src/delivery/failover/index.js';
import { CircuitBreaker } from '../../src/delivery/circuit-breaker/circuit-breaker.js';
import { PushProvider } from '../../src/delivery/providers/push-provider.js';
import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from '../../src/delivery/providers/types.js';
import type { ProviderFailoverConfig } from '../../src/delivery/failover/types.js';
import { ComplianceAuditService } from '../../src/compliance/compliance-audit.js';
import { ConsentService } from '../../src/compliance/consent-service.js';
import { DndRegistryService } from '../../src/compliance/dnd-registry.js';
import { SmsDispatcher } from '../../src/delivery/sms-dispatcher.js';
import type {
  SmsProvider,
} from '../../src/delivery/types.js';
import {
  InMemoryPreferenceCache,
  InMemoryPreferenceStore,
  PreferenceService,
} from '../../src/preferences/index.js';

const circuitBreaker = (provider: string): CircuitBreaker =>
  new CircuitBreaker({
    provider,
    thresholds: {
      failureRateThreshold: 1,
      responseTimeThresholdMs: 10000,
      minimumRequests: 10,
      openStateDurationMs: 1000,
    },
  });

describe('Notification Engine end-to-end flow', () => {
  it('ingests, processes, routes, delivers, and tracks a notification', async () => {
    const userId = 'e2e-user-001';
    const notificationId = 'e2e-notification-001';

    const event = createEvent(
      'transaction.failed',
      {
        transactionId: 'transaction-e2e-001',
        amount: 125.5,
        currency: 'USD',
        reason: 'insufficient-funds',
      },
      {
        userId,
        eventId: 'e2e-event-001',
        correlationId: 'e2e-correlation-001',
        source: 'e2e-test',
      },
    );

    const serialized = serializeEvent(event);
    const ingestedEvent = deserializeEvent(serialized.value);

    expect(ingestedEvent.event_id).toBe(event.event_id);
    expect(ingestedEvent.event_type).toBe('transaction.failed');
    expect(ingestedEvent.user_id).toBe(userId);
    expect(serialized.headers['content-type']).toBe('application/json');
    expect(serialized.headers['schema-version']).toBe('1.0');

    const enricher = {
      enrich: async (processedEvent: typeof event): Promise<EnrichedEvent> => ({
        event: processedEvent,
        user: {
          userId,
          email: 'e2e@example.com',
          phone: '+15550000001',
          timezone: 'America/New_York',
          isActive: true,
        },
        preferences: [],
      }),
    };

    const deduplicator = {
      isDuplicate: async (): Promise<boolean> => false,
    };

    const pipeline = new IngestionPipeline(
      deduplicator,
      enricher,
      new EventRouter(),
    );

    const processed = await pipeline.process(ingestedEvent);

    expect(processed.duplicate).toBe(false);
    expect(processed.routing).toEqual({
      channels: ['push', 'email'],
      reason: 'system-default',
    });

    const notification: PreparedNotification = {
      id: notificationId,
      userId,
      channel: 'push',
      recipient: 'e2e-device-token',
      subject: 'Transaction failed',
      body: 'Your transaction could not be completed.',
    };

    const pushProvider = new PushProvider({
      testMode: true,
      providerName: 'e2e-push-provider',
    });

    const emailProvider = new (
      await import('../../src/delivery/providers/email-provider.js')
    ).EmailProvider({
      testMode: true,
      providerName: 'e2e-email-provider',
    });

    const providerConfigs = new Map<'push' | 'email', ProviderFailoverConfig>([
      [
        'push',
        {
          channel: 'push',
          providers: [
            {
              providerName: 'e2e-push-provider',
              provider: pushProvider,
              circuitBreaker: circuitBreaker('e2e-push-provider'),
            },
          ],
        },
      ],
      [
        'email',
        {
          channel: 'email',
          providers: [
            {
              providerName: 'e2e-email-provider',
              provider: emailProvider,
              circuitBreaker: circuitBreaker('e2e-email-provider'),
            },
          ],
        },
      ],
    ]);

    const dispatcher = new MultiChannelDispatcher(
      new ProviderFailover(new IdempotencyStore()),
    );

    const deliveries = await dispatcher.dispatch(
      notification,
      processed.routing?.channels.filter(
        (channel): channel is 'push' | 'email' =>
          channel === 'push' || channel === 'email',
      ) ?? [],
      providerConfigs,
    );

    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((delivery) => delivery.channel)).toEqual([
      'push',
      'email',
    ]);

    expect(
      deliveries.every(
        (delivery) => delivery.result.receipt.status === 'accepted',
      ),
    ).toBe(true);

    const tracker = new DeliveryAcknowledgementTracker();
    const acknowledgements: string[] = [];

    tracker.registerCallback((acknowledgement) => {
      acknowledgements.push(
        `${acknowledgement.notificationId}:${acknowledgement.channel}:${acknowledgement.status}`,
      );
    });

    for (const delivery of deliveries) {
      const provider: DeliveryProvider =
        delivery.channel === 'push' ? pushProvider : emailProvider;

      const status = await provider.getStatus(
        delivery.result.receipt.externalId,
      );

      tracker.updateStatus(
        notificationId,
        delivery.channel,
        delivery.result.provider,
        status.externalId,
        'delivered',
      );
    }

    expect(acknowledgements).toEqual([
      'e2e-notification-001:push:delivered',
      'e2e-notification-001:email:delivered',
    ]);

    expect(tracker.get(notificationId, 'push')).toMatchObject({
      notificationId,
      channel: 'push',
      provider: 'e2e-push-provider',
      externalId: 'fcm-test-e2e-notification-001',
      status: 'delivered',
    });

    expect(tracker.get(notificationId, 'email')).toMatchObject({
      notificationId,
      channel: 'email',
      provider: 'e2e-email-provider',
      externalId: 'email-test-e2e-notification-001',
      status: 'delivered',
    });
  });

  it('allows a DND-registered user to receive a mandatory transactional SMS', async () => {
    const userId = 'dnd-user-001';

    const event = createEvent(
      'transaction.failed',
      {
        transactionId: 'transaction-dnd-001',
        amount: 250,
        currency: 'USD',
        reason: 'insufficient-funds',
      },
      {
        userId,
        eventId: 'dnd-event-001',
        correlationId: 'dnd-correlation-001',
        source: 'e2e-test',
      },
    );

    const dndRegistry = new DndRegistryService();
    const consentService = new ConsentService();
    const auditService = new ComplianceAuditService();

    consentService.record(userId, 'sms', 'OPTED_IN', 'E2E test consent');

    let delivered = false;

    const provider: SmsProvider = {
      send: async (): Promise<void> => {
        delivered = true;
      },
    };

    const dispatcher = new SmsDispatcher(
      {
        dndRegistry,
        consentService,
        auditService,
      },
      provider,
    );

    const result = await dispatcher.dispatch({
      userId,
      phoneNumber: '+15550000001',
      event,
      rendered: {
        templateId: 'e2e-dnd-template',
        eventType: 'transaction.failed',
        channel: 'sms',
        locale: 'en',
        version: 1,
        variant: 'A',
        subject: 'Transaction failed',
        body: 'Your transaction could not be completed.',
      },
    });

    expect(result).toEqual({
      dispatched: true,
    });

    expect(delivered).toBe(true);

    const auditEntries = auditService.findByUser(userId);

    expect(auditEntries).toContainEqual(
      expect.objectContaining({
        userId,
        eventId: 'dnd-event-001',
        action: 'DND_ALLOWED',
        channel: 'sms',
        classification: 'TRANSACTIONAL',
      }),
    );

    expect(auditEntries).not.toContainEqual(
      expect.objectContaining({
        action: 'DND_BLOCKED',
      }),
    );
  });

  it('preserves an in-flight delivery when the user changes preferences', async () => {
    const userId = 'preference-change-user-001';
    const store = new InMemoryPreferenceStore();
    const cache = new InMemoryPreferenceCache();
    const preferenceService = new PreferenceService(store, cache);

    await preferenceService.get(userId);

    await preferenceService.update(userId, {
      channels: {
        sms: { enabled: false, mode: 'disabled' },
        email: { enabled: true, mode: 'immediate' },
        push: { enabled: true, mode: 'immediate' },
        whatsapp: { enabled: false, mode: 'disabled' },
        'in-app': { enabled: false, mode: 'disabled' },
        ivr: { enabled: false, mode: 'disabled' },
        webhook: { enabled: false, mode: 'disabled' },
      },
      categories: {
        'transaction.failed': true,
      },
    });

    const enricher = {
      enrich: async (
        processedEvent: EnrichedEvent['event'],
      ): Promise<EnrichedEvent> => ({
        event: processedEvent,
        user: {
          userId,
          email: 'preference-change@example.com',
          phone: '+15550000002',
          timezone: 'America/New_York',
          isActive: true,
        },
        preferences: [],
      }),
    };

    const deduplicator = {
      isDuplicate: async (): Promise<boolean> => false,
    };

    const pipeline = new IngestionPipeline(
      deduplicator,
      enricher,
      new EventRouter(),
      preferenceService,
    );

    const firstEvent = createEvent(
      'transaction.failed',
      {
        transactionId: 'transaction-preference-001',
        amount: 100,
        currency: 'USD',
        reason: 'insufficient-funds',
      },
      {
        userId,
        eventId: 'preference-event-001',
        correlationId: 'preference-correlation-001',
        source: 'e2e-test',
      },
    );

    const firstResult = await pipeline.process(firstEvent);

    expect(firstResult.routing).toEqual({
      channels: ['email', 'push'],
      reason: 'user-preference',
    });

    let resolveDelivery!: () => void;
    let resolveDeliveryStarted!: () => void;

    const deliveryStarted = new Promise<void>((resolve) => {
      resolveDeliveryStarted = resolve;
    });

    const releaseDelivery = new Promise<void>((resolve) => {
      resolveDelivery = resolve;
    });

    const createControlledProvider = (
      providerName: string,
    ): DeliveryProvider => ({
      send: async (
        notification: PreparedNotification,
      ): Promise<DeliveryReceipt> => {
        expect(notification.id).toBeDefined();
        resolveDeliveryStarted();
        await releaseDelivery;

        return {
          externalId: `${providerName}-001`,
          status: 'accepted',
          provider: providerName,
        };
      },
      getStatus: async (externalId: string): Promise<DeliveryReceipt> => ({
        externalId,
        status: 'delivered',
        provider: providerName,
      }),
      validateRecipient: async (
        address: string,
      ): Promise<RecipientValidationResult> => ({
        valid: address.length > 0,
      }),
      getQuota: async (): Promise<ProviderQuota> => ({}),
      healthCheck: async (): Promise<ProviderHealth> => ({
        provider: providerName,
        healthy: true,
        checkedAt: new Date().toISOString(),
      }),
    });

    const pushProvider = createControlledProvider(
      'preference-push-provider',
    );
    const emailProvider = createControlledProvider(
      'preference-email-provider',
    );

    const providerConfigs = new Map<'email' | 'push', ProviderFailoverConfig>([
      [
        'email',
        {
          channel: 'email',
          providers: [
            {
              providerName: 'preference-email-provider',
              provider: emailProvider,
              circuitBreaker: circuitBreaker('preference-email-provider'),
            },
          ],
        },
      ],
      [
        'push',
        {
          channel: 'push',
          providers: [
            {
              providerName: 'preference-push-provider',
              provider: pushProvider,
              circuitBreaker: circuitBreaker('preference-push-provider'),
            },
          ],
        },
      ],
    ]);

    const dispatcher = new MultiChannelDispatcher(
      new ProviderFailover(new IdempotencyStore()),
    );

    const notification: PreparedNotification = {
      id: 'preference-notification-001',
      userId,
      channel: 'email',
      recipient: 'preference-change@example.com',
      subject: 'Transaction failed',
      body: 'Your transaction could not be completed.',
    };

    const deliveryPromise = dispatcher.dispatch(
      notification,
      firstResult.routing?.channels.filter(
        (channel): channel is 'email' | 'push' =>
          channel === 'email' || channel === 'push',
      ) ?? [],
      providerConfigs,
    );

    await deliveryStarted;

    await preferenceService.update(userId, {
      channels: {
        push: { enabled: false, mode: 'disabled' },
        email: { enabled: true, mode: 'immediate' },
      },
    });

    const updatedPreferences = await preferenceService.get(userId);

    expect(updatedPreferences.channels.push.enabled).toBe(false);
    expect(updatedPreferences.channels.email.enabled).toBe(true);

    resolveDelivery();

    const deliveries = await deliveryPromise;

    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((delivery) => delivery.channel)).toEqual([
      'email',
      'push',
    ]);

    const secondEvent = createEvent(
      'transaction.failed',
      {
        transactionId: 'transaction-preference-002',
        amount: 200,
        currency: 'USD',
        reason: 'insufficient-funds',
      },
      {
        userId,
        eventId: 'preference-event-002',
        correlationId: 'preference-correlation-002',
        source: 'e2e-test',
      },
    );

    const secondResult = await pipeline.process(secondEvent);

    expect(secondResult.routing).toEqual({
      channels: ['email'],
      reason: 'user-preference',
    });
  });

  it('switches to a secondary provider when the primary provider fails', async () => {
    const userId = 'failover-user-001';
    const notificationId = 'failover-notification-001';

    const primaryProvider: DeliveryProvider = {
      send: async (): Promise<DeliveryReceipt> => {
        throw new Error('Primary provider unavailable');
      },
      getStatus: async (externalId: string): Promise<DeliveryReceipt> => ({
        externalId,
        status: 'failed',
        provider: 'primary-provider',
      }),
      validateRecipient: async (): Promise<RecipientValidationResult> => ({
        valid: true,
      }),
      getQuota: async (): Promise<ProviderQuota> => ({}),
      healthCheck: async (): Promise<ProviderHealth> => ({
        provider: 'primary-provider',
        healthy: false,
        checkedAt: new Date().toISOString(),
      }),
    };

    const secondaryProvider: DeliveryProvider = {
      send: async (): Promise<DeliveryReceipt> => ({
        externalId: 'secondary-provider-001',
        status: 'accepted',
        provider: 'secondary-provider',
      }),
      getStatus: async (externalId: string): Promise<DeliveryReceipt> => ({
        externalId,
        status: 'delivered',
        provider: 'secondary-provider',
      }),
      validateRecipient: async (): Promise<RecipientValidationResult> => ({
        valid: true,
      }),
      getQuota: async (): Promise<ProviderQuota> => ({}),
      healthCheck: async (): Promise<ProviderHealth> => ({
        provider: 'secondary-provider',
        healthy: true,
        checkedAt: new Date().toISOString(),
      }),
    };

    const failover = new ProviderFailover(new IdempotencyStore());

    const result = await failover.send(
      {
        id: notificationId,
        userId,
        channel: 'email',
        recipient: 'failover@example.com',
        subject: 'Provider failover test',
        body: 'Testing provider failover.',
      },
      {
        channel: 'email',
        providers: [
          {
            providerName: 'primary-provider',
            provider: primaryProvider,
            circuitBreaker: circuitBreaker('primary-provider'),
          },
          {
            providerName: 'secondary-provider',
            provider: secondaryProvider,
            circuitBreaker: circuitBreaker('secondary-provider'),
          },
        ],
      },
    );

    expect(result.provider).toBe('secondary-provider');
    expect(result.receipt).toMatchObject({
      externalId: 'secondary-provider-001',
      status: 'accepted',
      provider: 'secondary-provider',
    });
    expect(result.failedOver).toBe(true);
    expect(result.attempts).toHaveLength(2);

    expect(result.attempts[0]).toMatchObject({
      provider: 'primary-provider',
      success: false,
    });

    expect(result.attempts[1]).toMatchObject({
      provider: 'secondary-provider',
      success: true,
    });

    const tracker = new DeliveryAcknowledgementTracker();

    tracker.updateStatus(
      notificationId,
      'email',
      result.provider,
      result.receipt.externalId,
      'delivered',
    );

    expect(tracker.get(notificationId, 'email')).toMatchObject({
      notificationId,
      channel: 'email',
      provider: 'secondary-provider',
      externalId: 'secondary-provider-001',
      status: 'delivered',
    });
  });
});