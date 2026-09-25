import type { PreparedNotification } from '../providers/types.js';
import type { RoutingCandidate, RoutingChannel } from '../routing/types.js';

import type {
  ProviderFailoverConfig,
  ProviderFailoverResult,
} from './types.js';

import { ProviderFailover } from './provider-failover.js';

/** Result of one channel attempt during channel failover. */
export interface ChannelFailoverAttempt {
  channel: RoutingChannel;
  success: boolean;
  provider?: string;
  error?: string;
}

/** Aggregate result of trying the configured channel sequence. */
export interface ChannelFailoverResult {
  channel: RoutingChannel;
  result: ProviderFailoverResult;
  attempts: ChannelFailoverAttempt[];
  failedOver: boolean;
}

/** Attempts delivery across eligible fallback channels. */
export class ChannelFailover {
  public constructor(private readonly providerFailover: ProviderFailover) {}

  public async send(
    notification: PreparedNotification,
    candidates: RoutingCandidate[],
    providerConfigs: Map<RoutingChannel, ProviderFailoverConfig>,
  ): Promise<ChannelFailoverResult> {
    const attempts: ChannelFailoverAttempt[] = [];

    for (const candidate of candidates) {
      if (!candidate.eligible) {
        continue;
      }

      const config = providerConfigs.get(candidate.channel);

      if (config === undefined) {
        attempts.push({
          channel: candidate.channel,
          success: false,
          error: `No provider configuration for ${candidate.channel}`,
        });

        continue;
      }

      const channelNotification: PreparedNotification = {
        ...notification,
        channel: candidate.channel,
      };

      try {
        const result = await this.providerFailover.send(
          channelNotification,
          config,
        );

        attempts.push({
          channel: candidate.channel,
          success: true,
          provider: result.provider,
        });

        return {
          channel: candidate.channel,
          result,
          attempts,
          failedOver: attempts.length > 1,
        };
      } catch (error: unknown) {
        attempts.push({
          channel: candidate.channel,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Error(`All delivery channels failed for ${notification.id}`);
  }
}
