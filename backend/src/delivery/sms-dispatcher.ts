import type {
  ComplianceAuditService,
  ConsentService,
  DndClassification,
  DndRegistryService,
  FrequencyCapService,
  QuietHoursQueue,
  QuietHoursService,
} from '../compliance/index.js';
import { DndClassificationService } from '../compliance/dnd-classifier.js';
import type { EventEnvelope } from '../events/types/events.js';
import type { RenderedTemplate } from '../template/types/template-types.js';
import type {
  DeliveryComplianceContext,
  DeliveryResult,
  SmsMessage,
  SmsProvider,
} from './types.js';

export interface SmsDispatcherDependencies {
  dndRegistry: DndRegistryService;
  consentService: ConsentService;
  auditService: ComplianceAuditService;
  frequencyCapService?: FrequencyCapService;
  quietHoursService?: QuietHoursService;
  quietHoursQueue?: QuietHoursQueue;
  classifier?: DndClassificationService;
}

export class SmsDispatcher {
  private readonly classifier: DndClassificationService;

  constructor(
    private readonly dependencies: SmsDispatcherDependencies,
    private readonly provider: SmsProvider,
  ) {
    this.classifier =
      dependencies.classifier ?? new DndClassificationService();
  }

  async dispatch(
    context: DeliveryComplianceContext,
  ): Promise<DeliveryResult> {
    const classification = this.classify(context.event);
    const isCritical = context.event.priority === 'critical';

    /*
     * Non-critical notifications are checked against frequency caps
     * before quiet hours and the final DND gate.
     */
    if (!isCritical && this.dependencies.frequencyCapService) {
      const rules = context.frequencyCapRules ?? [];

      if (rules.length > 0) {
        const frequencyResult =
          await this.dependencies.frequencyCapService.check({
            userId: context.userId,
            channel: 'sms',
            eventType: context.event.event_type,
            rules,
          });

        if (!frequencyResult.allowed) {
          this.dependencies.auditService.record({
            userId: context.userId,
            eventId: context.event.event_id,
            action: 'FREQUENCY_CAPPED',
            channel: 'sms',
            classification,
            reason: `Frequency cap exceeded: ${
              frequencyResult.exceededRule ?? 'unknown rule'
            }`,
          });

          return {
            dispatched: false,
            blockedReason: 'FREQUENCY_CAPPED',
          };
        }
      }
    }

    /*
     * Non-critical notifications are queued during quiet hours.
     * Critical notifications bypass quiet hours.
     */
    if (
      !isCritical &&
      this.dependencies.quietHoursService &&
      this.dependencies.quietHoursQueue &&
      context.quietHours &&
      context.quietHoursNotification
    ) {
      const shouldQueue =
        this.dependencies.quietHoursService.shouldQueue(
          context.quietHoursNotification,
          context.quietHours,
        );

      if (shouldQueue) {
        this.dependencies.quietHoursQueue.add(
          context.quietHoursNotification,
        );

        this.dependencies.auditService.record({
          userId: context.userId,
          eventId: context.event.event_id,
          action: 'QUIET_HOURS_QUEUED',
          channel: 'sms',
          classification,
          reason: 'Notification queued during user quiet hours',
        });

        return {
          dispatched: false,
          queued: true,
          blockedReason: 'QUIET_HOURS',
        };
      }
    }

    if (isCritical) {
      this.dependencies.auditService.record({
        userId: context.userId,
        eventId: context.event.event_id,
        action: 'CRITICAL_BYPASS',
        channel: 'sms',
        classification,
        reason:
          'Critical notification bypassed frequency caps and quiet hours',
      });
    }

    /*
     * FINAL COMPLIANCE GATE:
     * DND and consent checks must happen immediately before SMS dispatch.
     */
    const allowed = await this.evaluateFinalCompliance(
      context,
      classification,
    );

    if (!allowed) {
      return {
        dispatched: false,
        blockedReason: 'COMPLIANCE_BLOCKED',
      };
    }

    const message: SmsMessage = {
      userId: context.userId,
      phoneNumber: context.phoneNumber,
      event: context.event,
      rendered: context.rendered,
    };

    await this.provider.send(message);

    return {
      dispatched: true,
    };
  }

  private classify(event: EventEnvelope): DndClassification {
    return this.classifier.classify(event.event_type);
  }

  private async evaluateFinalCompliance(
    context: DeliveryComplianceContext,
    classification: DndClassification,
  ): Promise<boolean> {
    const {
      dndRegistry,
      consentService,
      auditService,
    } = this.dependencies;

    const dndEntry = await dndRegistry.lookup(context.userId);

    if (
      dndEntry?.isRegistered &&
      classification === 'PROMOTIONAL'
    ) {
      auditService.record({
        userId: context.userId,
        eventId: context.event.event_id,
        action: 'DND_BLOCKED',
        channel: 'sms',
        classification,
        reason: 'Promotional SMS blocked by DND registration',
      });

      return false;
    }

    const hasConsent = consentService.hasConsent(
      context.userId,
      'sms',
    );

    if (!hasConsent) {
      auditService.record({
        userId: context.userId,
        eventId: context.event.event_id,
        action: 'DND_BLOCKED',
        channel: 'sms',
        classification,
        reason: 'SMS blocked because consent is not opted in',
      });

      return false;
    }

    auditService.record({
      userId: context.userId,
      eventId: context.event.event_id,
      action: 'DND_ALLOWED',
      channel: 'sms',
      classification,
      reason: 'Final DND and consent checks passed',
    });

    return true;
  }
}