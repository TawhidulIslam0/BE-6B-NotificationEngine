import type { ChannelEngagementMetrics, RoutingChannel } from './types.js';

export class DeliveryMetrics {
  private readonly metrics = new Map<string, ChannelEngagementMetrics>();

  constructor(initialMetrics: ChannelEngagementMetrics[] = []) {
    for (const metric of initialMetrics) {
      this.set(metric);
    }
  }

  private key(userId: string, channel: RoutingChannel): string {
    return `${userId}:${channel}`;
  }

  set(metric: ChannelEngagementMetrics): void {
    this.metrics.set(this.key(metric.userId, metric.channel), { ...metric });
  }

  get(userId: string, channel: RoutingChannel): ChannelEngagementMetrics {
    return (
      this.metrics.get(this.key(userId, channel)) ?? {
        userId,
        channel,
        sent: 0,
        delivered: 0,
        opened: 0,
        failed: 0,
      }
    );
  }

  deliveryRate(userId: string, channel: RoutingChannel): number {
    const metric = this.get(userId, channel);

    if (metric.sent === 0) {
      return 0;
    }

    return Math.min(1, Math.max(0, metric.delivered / metric.sent));
  }

  engagementRate(userId: string, channel: RoutingChannel): number {
    const metric = this.get(userId, channel);

    if (metric.delivered === 0) {
      return 0;
    }

    return Math.min(1, Math.max(0, metric.opened / metric.delivered));
  }

  recordDelivery(userId: string, channel: RoutingChannel): void {
    const metric = this.get(userId, channel);

    this.set({
      ...metric,
      sent: metric.sent + 1,
      delivered: metric.delivered + 1,
    });
  }

  recordFailure(userId: string, channel: RoutingChannel): void {
    const metric = this.get(userId, channel);

    this.set({
      ...metric,
      sent: metric.sent + 1,
      failed: metric.failed + 1,
    });
  }
}
