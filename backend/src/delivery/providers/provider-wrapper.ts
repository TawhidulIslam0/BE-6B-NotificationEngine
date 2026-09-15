import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { ProviderRateLimiter } from './rate-limiter.js';

export interface ProviderWrapperOptions {
  providerName: string;
  rateLimiter: ProviderRateLimiter;
  circuitBreaker: CircuitBreaker;
  healthCheck?: () => Promise<ProviderHealth>;
}

export class ProviderWrapper implements DeliveryProvider {
  public constructor(
    private readonly provider: DeliveryProvider,
    private readonly options: ProviderWrapperOptions,
  ) {}

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    await this.options.rateLimiter.waitForSlot();

    return this.options.circuitBreaker.execute(() =>
      this.provider.send(notification),
    );
  }

  public async getStatus(externalId: string): Promise<DeliveryReceipt> {
    await this.options.rateLimiter.waitForSlot();

    return this.options.circuitBreaker.execute(() =>
      this.provider.getStatus(externalId),
    );
  }

  public async validateRecipient(
    address: string,
  ): Promise<RecipientValidationResult> {
    await this.options.rateLimiter.waitForSlot();

    return this.options.circuitBreaker.execute(() =>
      this.provider.validateRecipient(address),
    );
  }

  public async getQuota(): Promise<ProviderQuota> {
    return this.options.circuitBreaker.execute(() => this.provider.getQuota());
  }

  public async healthCheck(): Promise<ProviderHealth> {
    if (this.options.healthCheck !== undefined) {
      return this.options.healthCheck();
    }

    return this.provider.healthCheck();
  }

  public getCircuitState(): string {
    return this.options.circuitBreaker.getState();
  }
}
