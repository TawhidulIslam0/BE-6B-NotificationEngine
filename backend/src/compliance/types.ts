export type DndClassification = 'TRANSACTIONAL' | 'PROMOTIONAL';

export type ConsentStatus = 'OPTED_IN' | 'OPTED_OUT';

export type ConsentChannel =
  'sms' | 'email' | 'push' | 'whatsapp' | 'in-app' | 'ivr' | 'webhook';

export interface DndRegistryEntry {
  userId: string;
  phoneNumber: string;
  isRegistered: boolean;
  registeredAt?: string;
  source: 'simulated-dnd-database';
}

export interface ConsentRecord {
  id: string;
  userId: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  reason?: string;
  recordedAt: string;
  source: string;
}

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

export interface FrequencyCapRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface FrequencyCapRequest {
  userId: string;
  channel: ConsentChannel;
  eventType: string;
  rules: FrequencyCapRule[];
}

export interface FrequencyCapResult {
  allowed: boolean;
  exceededRule?: string;
  counts: Record<string, number>;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

export interface QuietHoursResult {
  quiet: boolean;
  nextAllowedAt?: string;
}

export interface QuietHoursNotification {
  id: string;
  userId: string;
  channel: ConsentChannel;
  title: string;
  body: string;
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}
