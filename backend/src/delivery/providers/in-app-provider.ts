import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

import type {
  SocketNotificationPayload,
  SocketNotificationServer,
} from '../../infrastructure/socket/socket-server.js';

export interface InAppProviderOptions {
  providerName?: string;
  socketNotificationServer?: SocketNotificationServer;
  testMode?: boolean;
}

export class InAppProvider implements DeliveryProvider {
  private readonly providerName: string;

  public readonly emittedNotifications: PreparedNotification[] = [];

  public constructor(private readonly options: InAppProviderOptions = {}) {
    this.providerName = options.providerName ?? 'socket-io-in-app';

    if (
      options.testMode !== true &&
      options.socketNotificationServer === undefined
    ) {
      throw new Error('socketNotificationServer is required outside test mode');
    }
  }

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    if (notification.channel !== 'in-app') {
      throw new Error('InAppProvider only supports in-app notifications');
    }

    if (this.options.testMode === true) {
      this.emittedNotifications.push(notification);

      return {
        externalId: `in-app-test-${notification.id}`,
        status: 'delivered',
        provider: this.providerName,
        rawResponse: {
          testMode: true,
          recipient: notification.recipient,
        },
      };
    }

    const socketNotificationServer = this.options.socketNotificationServer;

    if (socketNotificationServer === undefined) {
      throw new Error('Socket.io notification server is not configured');
    }

    const payload: SocketNotificationPayload = {
      recipient: notification.recipient,
      notification: {
        id: notification.id,
        userId: notification.userId,
        channel: 'in-app',
        recipient: notification.recipient,
        subject: notification.subject ?? '',
        body: notification.body,
      },
    };

    socketNotificationServer.sendToUser(notification.recipient, payload);

    return {
      externalId: `in-app-${notification.id}`,
      status: 'accepted',
      provider: this.providerName,
      rawResponse: {
        recipient: notification.recipient,
        transport: 'socket.io',
      },
    };
  }

  public async getStatus(externalId: string): Promise<DeliveryReceipt> {
    return {
      externalId,
      status: 'unknown',
      provider: this.providerName,
    };
  }

  public async validateRecipient(
    address: string,
  ): Promise<RecipientValidationResult> {
    const valid = address.trim().length > 0;

    return valid
      ? { valid: true }
      : {
          valid: false,
          reason: 'In-app recipient cannot be empty',
        };
  }

  public async getQuota(): Promise<ProviderQuota> {
    return {};
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();

    if (this.options.testMode === true) {
      return {
        provider: this.providerName,
        healthy: true,
        checkedAt,
        message: 'In-app provider is available in test mode',
      };
    }

    if (this.options.socketNotificationServer === undefined) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message: 'Socket.io notification server is not configured',
      };
    }

    return {
      provider: this.providerName,
      healthy: true,
      checkedAt,
      message: 'Socket.io notification server is configured',
    };
  }

  public disconnect(): void {
    // The SocketNotificationServer lifecycle is managed by the application.
  }
}
