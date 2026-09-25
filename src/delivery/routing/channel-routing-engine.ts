import type {
  RoutingChannel,
  RoutingContext,
  RoutingDecision,
} from './types.js';
import { ChannelScoring } from './channel-scoring.js';
import { RegulatoryOverride } from './regulatory-override.js';

const DEFAULT_CHANNELS: RoutingChannel[] = [
  'sms',
  'email',
  'push',
  'whatsapp',
  'in-app',
];

export class ChannelRoutingEngine {
  constructor(
    private readonly regulatoryOverride: RegulatoryOverride,
    private readonly scoring: ChannelScoring,
  ) {}

  route(context: RoutingContext): RoutingDecision {
    const { notification, eventType, eventCategory, preferences, budget } =
      context;

    const availableChannels = context.availableChannels ?? DEFAULT_CHANNELS;

    const regulatoryChannel = this.regulatoryOverride.resolve(
      eventType,
      availableChannels,
    );

    if (regulatoryChannel !== null) {
      return {
        notificationId: notification.id,
        userId: notification.userId,
        eventType,
        eventCategory,
        regulatoryOverride: true,
        selectedChannel: regulatoryChannel,
        candidates: [
          {
            channel: regulatoryChannel,
            score: 1,
            preferenceScore: 1,
            deliveryScore: 1,
            costScore: 0,
            estimatedCostPaisa: 0,
            eligible: true,
            reason: 'Selected by regulatory override',
          },
        ],
        reason: `Regulatory requirement mandates ${regulatoryChannel}`,
      };
    }

    const rankedCandidates = this.scoring.rank(
      notification.userId,
      availableChannels,
      preferences?.channels ?? {},
      budget,
    );

    const selected = rankedCandidates[0]?.channel ?? null;

    return {
      notificationId: notification.id,
      userId: notification.userId,
      eventType,
      eventCategory,
      regulatoryOverride: false,
      selectedChannel: selected,
      candidates: rankedCandidates,
      reason:
        selected === null
          ? 'No eligible delivery channel available'
          : `Selected ${selected} using preference, delivery, and cost optimisation`,
    };
  }
}
