import type { PreparedNotification } from '../providers/types.js';

import type {
  ProviderFailoverConfig,
  ProviderFailoverResult,
  ProviderAttempt,
} from './types.js';

import { IdempotencyStore } from './idempotency-store.js';

/** Tries alternate providers when the preferred provider cannot deliver. */
export class ProviderFailover {
  public constructor(private readonly idempotencyStore: IdempotencyStore) {}

  public async send(
    notification: PreparedNotification,
    config: ProviderFailoverConfig,
  ): Promise<ProviderFailoverResult> {
    const idempotencyKey = this.idempotencyStore.createKey(
      notification.id,
      notification.channel,
    );

    const existing = this.idempotencyStore.get(idempotencyKey);

    if (existing !== undefined) {
      return {
        receipt: {
          externalId: existing.externalId,
          status: 'accepted',
          provider: existing.provider,
          rawResponse: {
            idempotentReplay: true,
          },
        },
        provider: existing.provider,
        attempts: [],
        failedOver: false,
      };
    }

    const attempts: ProviderAttempt[] = [];

    for (const providerRoute of config.providers) {
      if (!providerRoute.circuitBreaker.canExecute()) {
        continue;
      }

      const startedAt = Date.now();

      try {
        const receipt = await providerRoute.provider.send(notification);

        const responseTimeMs = Date.now() - startedAt;

        providerRoute.circuitBreaker.recordSuccess(responseTimeMs);

        attempts.push({
          provider: providerRoute.providerName,
          success: true,
          responseTimeMs,
        });

        this.idempotencyStore.set({
          key: idempotencyKey,
          provider: providerRoute.providerName,
          externalId: receipt.externalId,
          recordedAt: Date.now(),
        });

        return {
          receipt,
          provider: providerRoute.providerName,
          attempts,
          failedOver: attempts.length > 1,
        };
      } catch (error: unknown) {
        const responseTimeMs = Date.now() - startedAt;

        providerRoute.circuitBreaker.recordFailure(responseTimeMs);

        attempts.push({
          provider: providerRoute.providerName,
          success: false,
          responseTimeMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Error(`All providers failed for ${notification.channel}`);
  }
}
