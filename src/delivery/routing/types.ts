import type { PreparedNotification } from '../providers/types.js';

/** Channels considered by the routing engine. */
export type RoutingChannel = 'sms' | 'email' | 'push' | 'whatsapp' | 'in-app';

/** Business category used to apply routing and regulatory policy. */
export type EventCategory =
  'TXNX' | 'RISK' | 'SIPX' | 'MKTX' | 'REGX' | 'OTHR' | string;

/** User preference and priority for one delivery channel. */
export interface ChannelPreference {
  enabled: boolean;
  priority: number;
}

/** User-specific channel preferences for an event category or type. */
export interface UserChannelPreferences {
  userId: string;
  eventCategory: EventCategory;
  eventType?: string;
  channels: Partial<Record<RoutingChannel, ChannelPreference>>;
}

/** Historical engagement counters used to score channels. */
export interface ChannelEngagementMetrics {
  userId: string;
  channel: RoutingChannel;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

/** Daily and monthly delivery budget for a user. */
export interface UserCostBudget {
  userId: string;
  dailyLimitPaisa: number;
  dailySpentPaisa: number;
  monthlyLimitPaisa: number;
  monthlySpentPaisa: number;
}

/** Performance and cost characteristics of a channel. */
export interface ChannelCharacteristics {
  channel: RoutingChannel;
  deliveryRate: number;
  costPaisa: number;
  averageDeliveryTimeMs: number;
}

/** Required channels for a regulated event type. */
export interface RegulatoryRequirement {
  eventType: string;
  requiredChannels: RoutingChannel[];
}

/** Scored channel candidate produced during route selection. */
export interface RoutingCandidate {
  channel: RoutingChannel;
  score: number;
  preferenceScore: number;
  deliveryScore: number;
  costScore: number;
  estimatedCostPaisa: number;
  eligible: boolean;
  reason?: string;
}

/** Final routing result, including rejected candidates and rationale. */
export interface RoutingDecision {
  notificationId: string;
  userId: string;
  eventType: string;
  eventCategory: EventCategory;
  regulatoryOverride: boolean;
  selectedChannel: RoutingChannel | null;
  candidates: RoutingCandidate[];
  reason: string;
}

/** Inputs consumed by the channel routing engine. */
export interface RoutingContext {
  notification: PreparedNotification;
  eventType: string;
  eventCategory: EventCategory;
  availableChannels?: RoutingChannel[];
  preferences?: UserChannelPreferences;
  engagementMetrics?: ChannelEngagementMetrics[];
  budget?: UserCostBudget;
}

/** Relative weights applied when ranking channel candidates. */
export interface ChannelScoringWeights {
  preference: number;
  delivery: number;
  cost: number;
}
