import type {
  DeliveryAcknowledgement,
  DeliveryAcknowledgementStatus,
} from './types.js';

export type DeliveryAcknowledgementCallback = (
  acknowledgement: DeliveryAcknowledgement,
) => void;

export class DeliveryAcknowledgementTracker {
  private readonly acknowledgements = new Map<
    string,
    DeliveryAcknowledgement
  >();

  private readonly callbacks: DeliveryAcknowledgementCallback[] = [];

  public registerCallback(callback: DeliveryAcknowledgementCallback): void {
    this.callbacks.push(callback);
  }

  public record(acknowledgement: DeliveryAcknowledgement): void {
    const key = this.key(
      acknowledgement.notificationId,
      acknowledgement.channel,
    );

    this.acknowledgements.set(key, {
      ...acknowledgement,
    });

    for (const callback of this.callbacks) {
      callback({
        ...acknowledgement,
      });
    }
  }

  public updateStatus(
    notificationId: string,
    channel: string,
    provider: string,
    externalId: string,
    status: DeliveryAcknowledgementStatus,
    metadata?: Record<string, unknown>,
  ): void {
    this.record({
      notificationId,
      channel,
      provider,
      externalId,
      status,
      timestamp: new Date().toISOString(),
      ...(metadata === undefined ? {} : { metadata }),
    });
  }

  public get(
    notificationId: string,
    channel: string,
  ): DeliveryAcknowledgement | undefined {
    const acknowledgement = this.acknowledgements.get(
      this.key(notificationId, channel),
    );

    return acknowledgement === undefined ? undefined : { ...acknowledgement };
  }

  private key(notificationId: string, channel: string): string {
    return `${notificationId}:${channel}`;
  }
}
