import type {
  ChannelPreference,
  RoutingCandidate,
  RoutingChannel,
  UserCostBudget,
} from './types.js';
import { CostOptimizer } from './cost-optimizer.js';
import { DeliveryMetrics } from './delivery-metrics.js';

const DEFAULT_WEIGHTS = {
  preference: 0.4,
  delivery: 0.4,
  cost: 0.2,
};

export class ChannelScoring {
  private readonly weights: {
    preference: number;
    delivery: number;
    cost: number;
  };

  constructor(
    private readonly deliveryMetrics: DeliveryMetrics,
    private readonly costOptimizer: CostOptimizer,
    weights: Partial<typeof DEFAULT_WEIGHTS> = {},
  ) {
    this.weights = {
      ...DEFAULT_WEIGHTS,
      ...weights,
    };

    const total =
      this.weights.preference + this.weights.delivery + this.weights.cost;

    if (total <= 0) {
      throw new Error('Channel scoring weights must have a positive total');
    }

    this.weights.preference /= total;
    this.weights.delivery /= total;
    this.weights.cost /= total;
  }

  scoreChannel(
    userId: string,
    channel: RoutingChannel,
    preference: ChannelPreference | undefined,
    budget: UserCostBudget | undefined,
  ): RoutingCandidate {
    const cost = this.costOptimizer.getCharacteristics(channel);

    if (!this.costOptimizer.isWithinBudget(channel, budget)) {
      return {
        channel,
        score: 0,
        preferenceScore: 0,
        deliveryScore: this.deliveryMetrics.deliveryRate(userId, channel),
        costScore: 0,
        estimatedCostPaisa: cost.costPaisa,
        eligible: false,
        reason: 'User cost budget exceeded',
      };
    }

    const preferenceScore =
      preference === undefined
        ? 0.5
        : preference.enabled
          ? Math.min(1, Math.max(0, preference.priority / 5))
          : 0;

    const deliveryScore = this.deliveryMetrics.deliveryRate(userId, channel);

    const costScore = this.costOptimizer.costScore(channel);

    const score =
      preferenceScore * this.weights.preference +
      deliveryScore * this.weights.delivery +
      costScore * this.weights.cost;

    return {
      channel,
      score,
      preferenceScore,
      deliveryScore,
      costScore,
      estimatedCostPaisa: cost.costPaisa,
      eligible: preference?.enabled !== false,
    };
  }

  rank(
    userId: string,
    channels: RoutingChannel[],
    preferences: Partial<Record<RoutingChannel, ChannelPreference>>,
    budget?: UserCostBudget,
  ): RoutingCandidate[] {
    return channels
      .map((channel) =>
        this.scoreChannel(userId, channel, preferences[channel], budget),
      )
      .filter((candidate) => candidate.eligible)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.estimatedCostPaisa - b.estimatedCostPaisa;
      });
  }
}
