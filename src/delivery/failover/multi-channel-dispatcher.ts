import type { PreparedNotification } from '../providers/types.js';
import type { RoutingChannel } from '../routing/types.js';

import type {
  ProviderFailoverConfig,
  ProviderFailoverResult,
} from './types.js';

import { ProviderFailover } from './provider-failover.js';

/** Results from dispatching a notification to multiple channels. */
export interface FanOutResult {
  channel: RoutingChannel;
  result: ProviderFailoverResult;
}

/** Dispatches notifications to independent channel providers in parallel. */
export class MultiChannelDispatcher {
  public constructor(private readonly providerFailover: ProviderFailover) {}

  public async dispatch(
    notification: PreparedNotification,
    channels: RoutingChannel[],
    providerConfigs: Map<RoutingChannel, ProviderFailoverConfig>,
  ): Promise<FanOutResult[]> {
    const deliveries = channels.map(async (channel) => {
      const config = providerConfigs.get(channel);

      if (config === undefined) {
        throw new Error(`No provider configuration for ${channel}`);
      }

      const channelNotification: PreparedNotification = {
        ...notification,
        channel,
      };

      const result = await this.providerFailover.send(
        channelNotification,
        config,
      );

      return {
        channel,
        result,
      };
    });

    return Promise.all(deliveries);
  }
}
