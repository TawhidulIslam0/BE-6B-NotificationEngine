import type { ConsentChannel } from '../../compliance/types.js';
import type { DeliveryProvider } from '../providers/types.js';

/** Registry that resolves one delivery provider per notification channel. */
export class ProviderRegistry {
  private readonly providers = new Map<ConsentChannel, DeliveryProvider>();

  /** Registers a provider and rejects duplicate channel registrations. */
  public register(channel: ConsentChannel, provider: DeliveryProvider): void {
    if (this.providers.has(channel)) {
      throw new Error(
        `A provider is already registered for channel: ${channel}`,
      );
    }

    this.providers.set(channel, provider);
  }

  /** Returns the provider registered for a channel or throws when absent. */
  public get(channel: ConsentChannel): DeliveryProvider {
    const provider = this.providers.get(channel);

    if (provider === undefined) {
      throw new Error(
        `No delivery provider registered for channel: ${channel}`,
      );
    }

    return provider;
  }

  /** Reports whether a provider is registered for a channel. */
  public has(channel: ConsentChannel): boolean {
    return this.providers.has(channel);
  }

  /** Lists channels with registered providers. */
  public listChannels(): ConsentChannel[] {
    return [...this.providers.keys()];
  }
}
