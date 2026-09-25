import type { DeliveryProvider, ProviderHealth } from '../providers/types.js';

/** Aggregated health state for registered delivery providers. */
export interface ProviderHealthSummary {
  healthy: boolean;
  checkedAt: string;
  providers: ProviderHealth[];
}

/** Probes provider health and summarizes channel availability. */
export class ProviderHealthService {
  public constructor(private readonly providers: DeliveryProvider[]) {}

  public async checkAll(): Promise<ProviderHealthSummary> {
    const checkedAt = new Date().toISOString();

    const results = await Promise.all(
      this.providers.map(async (provider): Promise<ProviderHealth> => {
        try {
          return await provider.healthCheck();
        } catch (error: unknown) {
          return {
            provider: provider.constructor.name,
            healthy: false,
            checkedAt,
            message:
              error instanceof Error
                ? error.message
                : 'Unknown provider health-check error',
          };
        }
      }),
    );

    return {
      healthy: results.every((provider) => provider.healthy),
      checkedAt,
      providers: results,
    };
  }
}
