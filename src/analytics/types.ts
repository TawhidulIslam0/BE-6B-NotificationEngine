import type { EventPriority } from '../events/types/events.js';

/** Delivery channels represented in analytics aggregates. */
export type AnalyticsChannel = 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app';

/** Normalized delivery lifecycle statuses used by analytics queries. */
export type AnalyticsStatus =
  'accepted' | 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';

/** Supported time buckets for analytics aggregation. */
export type AnalyticsWindow = 'hourly' | 'daily' | 'weekly';

/** Count of deliveries grouped by channel and status. */
export interface DeliveryCounter {
  channel: AnalyticsChannel;
  status: AnalyticsStatus;
  count: number;
}

/** Failure count grouped by delivery channel. */
export interface FailureCounter {
  channel: AnalyticsChannel;
  count: number;
}

/** Aggregate latency measurements for a delivery channel. */
export interface LatencyMetric {
  channel: AnalyticsChannel;
  count: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
}

/** Delivery success and latency summary for one channel. */
export interface ChannelPerformance {
  channel: AnalyticsChannel;
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageLatencyMs: number;
}

/** Overall delivery and failure rates for a query period. */
export interface DeliveryRateMetric {
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  failureRate: number;
}

/** Opt-out count for a channel and reporting period. */
export interface OptOutTrend {
  period: string;
  channel: AnalyticsChannel;
  optOuts: number;
}

/** Monetary delivery cost with its currency. */
export interface CostMetric {
  totalCost: number;
  currency: string;
}

/** Cost metric grouped by channel. */
export interface ChannelCostMetric extends CostMetric {
  channel: AnalyticsChannel;
}

/** Cost metric grouped by event type. */
export interface EventTypeCostMetric extends CostMetric {
  eventType: string;
}

/** Cost metric grouped by user. */
export interface UserCostMetric extends CostMetric {
  userId: string;
}

/** Cost report broken down by channel, event type, and user. */
export interface CostAnalytics {
  total: CostMetric;
  byChannel: ChannelCostMetric[];
  byEventType: EventTypeCostMetric[];
  byUser: UserCostMetric[];
}

/** Delivery metrics for one time window. */
export interface AnalyticsAggregation {
  window: AnalyticsWindow;
  periodStart: Date;
  periodEnd: Date;
  delivery: DeliveryRateMetric;
  channels: ChannelPerformance[];
}

/** Optional filters accepted by analytics repositories and APIs. */
export interface AnalyticsQueryOptions {
  startDate?: Date;
  endDate?: Date;
  channel?: AnalyticsChannel;
  eventType?: string;
  userId?: string;
  priority?: EventPriority;
}
