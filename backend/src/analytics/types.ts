import type { EventPriority } from '../events/types/events.js';

export type AnalyticsChannel = 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app';

export type AnalyticsStatus =
  'accepted' | 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';

export type AnalyticsWindow = 'hourly' | 'daily' | 'weekly';

export interface DeliveryCounter {
  channel: AnalyticsChannel;
  status: AnalyticsStatus;
  count: number;
}

export interface FailureCounter {
  channel: AnalyticsChannel;
  count: number;
}

export interface LatencyMetric {
  channel: AnalyticsChannel;
  count: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
}

export interface ChannelPerformance {
  channel: AnalyticsChannel;
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageLatencyMs: number;
}

export interface DeliveryRateMetric {
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  failureRate: number;
}

export interface OptOutTrend {
  period: string;
  channel: AnalyticsChannel;
  optOuts: number;
}

export interface CostMetric {
  totalCost: number;
  currency: string;
}

export interface ChannelCostMetric extends CostMetric {
  channel: AnalyticsChannel;
}

export interface EventTypeCostMetric extends CostMetric {
  eventType: string;
}

export interface UserCostMetric extends CostMetric {
  userId: string;
}

export interface CostAnalytics {
  total: CostMetric;
  byChannel: ChannelCostMetric[];
  byEventType: EventTypeCostMetric[];
  byUser: UserCostMetric[];
}

export interface AnalyticsAggregation {
  window: AnalyticsWindow;
  periodStart: Date;
  periodEnd: Date;
  delivery: DeliveryRateMetric;
  channels: ChannelPerformance[];
}

export interface AnalyticsQueryOptions {
  startDate?: Date;
  endDate?: Date;
  channel?: AnalyticsChannel;
  eventType?: string;
  userId?: string;
  priority?: EventPriority;
}
