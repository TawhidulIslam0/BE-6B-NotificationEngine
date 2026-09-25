/** Regulatory classification used when evaluating do-not-disturb rules. */
export type DndClassification = 'TRANSACTIONAL' | 'PROMOTIONAL';

/** Current consent state for a user and channel. */
export type ConsentStatus = 'OPTED_IN' | 'OPTED_OUT';

/** Channels for which consent and compliance checks can be applied. */
export type ConsentChannel =
  'sms' | 'email' | 'push' | 'whatsapp' | 'in-app' | 'ivr' | 'webhook';

/** A user's registration state in the do-not-disturb registry. */
export interface DndRegistryEntry {
  userId: string;
  phoneNumber: string;
  isRegistered: boolean;
  registeredAt?: string;
  source: 'simulated-dnd-database';
}

/** Auditable consent decision recorded for a user and channel. */
export interface ConsentRecord {
  id: string;
  userId: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  reason?: string;
  recordedAt: string;
  source: string;
}

/** Immutable record of a compliance decision made during delivery. */
export interface ComplianceAuditEntry {
  id: string;
  userId: string;
  eventId?: string;
  action:
    | 'DND_BLOCKED'
    | 'DND_ALLOWED'
    | 'CONSENT_RECORDED'
    | 'FREQUENCY_CAPPED'
    | 'QUIET_HOURS_QUEUED'
    | 'CRITICAL_BYPASS';
  channel?: ConsentChannel;
  classification?: DndClassification;
  reason: string;
  recordedAt: string;
}

/** Maximum number of notifications allowed in a time window. */
export interface FrequencyCapRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Inputs required to evaluate frequency-cap rules. */
export interface FrequencyCapRequest {
  userId: string;
  channel: ConsentChannel;
  eventType: string;
  rules: FrequencyCapRule[];
}

/** Result of applying frequency-cap rules to a notification. */
export interface FrequencyCapResult {
  allowed: boolean;
  exceededRule?: string;
  counts: Record<string, number>;
}

/** User-local quiet-hours configuration. */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

/** Result of evaluating a notification against quiet hours. */
export interface QuietHoursResult {
  quiet: boolean;
  nextAllowedAt?: string;
}

/** Notification queued for delivery after quiet hours end. */
export interface QuietHoursNotification {
  id: string;
  userId: string;
  channel: ConsentChannel;
  title: string;
  body: string;
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}
