import type { PreparedNotification } from '../providers/types.js';

export type RoutingChannel = 'sms' | 'email' | 'push' | 'whatsapp' | 'in-app';

export type EventCategory =
  'TXNX' | 'RISK' | 'SIPX' | 'MKTX' | 'REGX' | 'OTHR' | string;

export interface ChannelPreference {
  enabled: boolean;
  priority: number;
}

export interface UserChannelPreferences {
  userId: string;
  eventCategory: EventCategory;
  eventType?: string;
  channels: Partial<Record<RoutingChannel, ChannelPreference>>;
}

export interface ChannelEngagementMetrics {
  userId: string;
  channel: RoutingChannel;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

export interface UserCostBudget {
  userId: string;
  dailyLimitPaisa: number;
  dailySpentPaisa: number;
  monthlyLimitPaisa: number;
  monthlySpentPaisa: number;
}

export interface ChannelCharacteristics {
  channel: RoutingChannel;
  deliveryRate: number;
  costPaisa: number;
  averageDeliveryTimeMs: number;
}

export interface RegulatoryRequirement {
  eventType: string;
  requiredChannels: RoutingChannel[];
}

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

export interface RoutingContext {
  notification: PreparedNotification;
  eventType: string;
  eventCategory: EventCategory;
  availableChannels?: RoutingChannel[];
  preferences?: UserChannelPreferences;
  engagementMetrics?: ChannelEngagementMetrics[];
  budget?: UserCostBudget;
}

export interface ChannelScoringWeights {
  preference: number;
  delivery: number;
  cost: number;
}
