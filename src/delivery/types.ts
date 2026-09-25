import type { EventEnvelope } from '../events/types/events.js';
import type { RenderedTemplate } from '../template/types/template-types.js';
import type {
  ConsentChannel,
  FrequencyCapRule,
  QuietHours,
  QuietHoursNotification,
} from '../compliance/types.js';

/** Rendered event data passed to an SMS provider. */
export interface SmsMessage {
  userId: string;
  phoneNumber: string;
  event: EventEnvelope;
  rendered: RenderedTemplate;
}

/** Minimal contract implemented by SMS delivery providers. */
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

/** Delivery data required by compliance checks before dispatch. */
export interface DeliveryComplianceContext {
  userId: string;
  phoneNumber: string;
  event: EventEnvelope;
  rendered: RenderedTemplate;
  quietHours?: QuietHours;
  frequencyCapRules?: FrequencyCapRule[];
  quietHoursNotification?: QuietHoursNotification;
}

/** Outcome of compliance evaluation and delivery dispatch. */
export interface DeliveryResult {
  dispatched: boolean;
  blockedReason?: string;
  auditId?: string;
  queued?: boolean;
}

/** Services used by the compliance-aware delivery path. */
export interface DeliveryComplianceDependencies {
  dndRegistry: import('../compliance/dnd-registry.js').DndRegistryService;
  consentService: import('../compliance/consent-service.js').ConsentService;
  auditService: import('../compliance/compliance-audit.js').ComplianceAuditService;
  frequencyCapService?: import('../compliance/frequency-cap.js').FrequencyCapService;
  quietHoursService?: import('../compliance/quiet-hours.js').QuietHoursService;
  quietHoursQueue?: import('../compliance/quiet-hours.js').QuietHoursQueue;
  classifier?: import('../compliance/dnd-classifier.js').DndClassificationService;
  channel?: ConsentChannel;
}
