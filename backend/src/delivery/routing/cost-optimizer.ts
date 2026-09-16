import type {
  ChannelCharacteristics,
  RoutingChannel,
  UserCostBudget,
} from './types.js';

const DEFAULT_CHANNEL_COSTS: Record<RoutingChannel, ChannelCharacteristics> = {
  sms: {
    channel: 'sms',
    deliveryRate: 0.965,
    costPaisa: 20,
    averageDeliveryTimeMs: 6500,
  },
  email: {
    channel: 'email',
    deliveryRate: 0.9,
    costPaisa: 3,
    averageDeliveryTimeMs: 30000,
  },
  push: {
    channel: 'push',
    deliveryRate: 0.7,
    costPaisa: 0,
    averageDeliveryTimeMs: 500,
  },
  whatsapp: {
    channel: 'whatsapp',
    deliveryRate: 0.925,
    costPaisa: 55,
    averageDeliveryTimeMs: 3500,
  },
  'in-app': {
    channel: 'in-app',
    deliveryRate: 1,
    costPaisa: 0,
    averageDeliveryTimeMs: 0,
  },
};

export class CostOptimizer {
  private readonly characteristics: Map<RoutingChannel, ChannelCharacteristics>;

  constructor(
    characteristics: ChannelCharacteristics[] = Object.values(
      DEFAULT_CHANNEL_COSTS,
    ),
  ) {
    this.characteristics = new Map(
      characteristics.map((item) => [item.channel, { ...item }]),
    );
  }

  getCharacteristics(channel: RoutingChannel): ChannelCharacteristics {
    const characteristics = this.characteristics.get(channel);

    if (characteristics === undefined) {
      throw new Error(`No channel characteristics configured for ${channel}`);
    }

    return characteristics;
  }

  isWithinBudget(
    channel: RoutingChannel,
    budget: UserCostBudget | undefined,
  ): boolean {
    if (budget === undefined) {
      return true;
    }

    const cost = this.getCharacteristics(channel).costPaisa;

    return (
      budget.dailySpentPaisa + cost <= budget.dailyLimitPaisa &&
      budget.monthlySpentPaisa + cost <= budget.monthlyLimitPaisa
    );
  }

  costScore(channel: RoutingChannel): number {
    const costs = [...this.characteristics.values()].map(
      (item) => item.costPaisa,
    );

    const maxCost = Math.max(...costs);

    if (maxCost === 0) {
      return 1;
    }

    const cost = this.getCharacteristics(channel).costPaisa;

    return 1 - cost / maxCost;
  }
}
