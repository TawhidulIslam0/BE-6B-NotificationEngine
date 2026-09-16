import type { RegulatoryRequirement, RoutingChannel } from './types.js';

const DEFAULT_REGULATORY_REQUIREMENTS: RegulatoryRequirement[] = [
  {
    eventType: 'REGX-001',
    requiredChannels: ['sms', 'email', 'push'],
  },
  {
    eventType: 'REGX-002',
    requiredChannels: ['email', 'push'],
  },
  {
    eventType: 'REGX-003',
    requiredChannels: ['email'],
  },
  {
    eventType: 'REGX-004',
    requiredChannels: ['email', 'in-app'],
  },
];

export class RegulatoryOverride {
  private readonly requirements: Map<string, RoutingChannel[]>;

  constructor(
    requirements: RegulatoryRequirement[] = DEFAULT_REGULATORY_REQUIREMENTS,
  ) {
    this.requirements = new Map(
      requirements.map((requirement) => [
        requirement.eventType,
        [...requirement.requiredChannels],
      ]),
    );
  }

  getRequiredChannels(eventType: string): RoutingChannel[] {
    return [...(this.requirements.get(eventType) ?? [])];
  }

  isRegulatory(eventType: string): boolean {
    return this.requirements.has(eventType);
  }

  resolve(
    eventType: string,
    availableChannels: RoutingChannel[],
  ): RoutingChannel | null {
    const required = this.getRequiredChannels(eventType);

    if (required.length === 0) {
      return null;
    }

    return (
      required.find((channel) => availableChannels.includes(channel)) ?? null
    );
  }
}
