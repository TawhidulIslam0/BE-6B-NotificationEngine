import type { ConsentChannel } from '../../compliance/types.js';
import type { DeliveryProvider } from '../providers/types.js';

export class ProviderRegistry {
  private readonly providers = new Map<ConsentChannel, DeliveryProvider>();

  public register(channel: ConsentChannel, provider: DeliveryProvider): void {
    if (this.providers.has(channel)) {
      throw new Error(
        `A provider is already registered for channel: ${channel}`,
      );
    }

    this.providers.set(channel, provider);
  }

  public get(channel: ConsentChannel): DeliveryProvider {
    const provider = this.providers.get(channel);

    if (provider === undefined) {
      throw new Error(
        `No delivery provider registered for channel: ${channel}`,
      );
    }

    return provider;
  }

  public has(channel: ConsentChannel): boolean {
    return this.providers.has(channel);
  }

  public listChannels(): ConsentChannel[] {
    return [...this.providers.keys()];
  }
}
