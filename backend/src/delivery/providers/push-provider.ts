import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

export interface PushProviderOptions {
  providerName?: string;
  projectId?: string;
  accessToken?: string;
  testMode?: boolean;

  /**
   * Optional HTTP implementation.
   * This makes the provider easy to test with mock servers.
   */
  fetcher?: typeof fetch;
}

interface FcmResponse {
  name?: string;
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
}

export class PushProvider implements DeliveryProvider {
  private readonly providerName: string;
  private readonly fetcher: typeof fetch;

  public constructor(private readonly options: PushProviderOptions = {}) {
    this.providerName = options.providerName ?? 'fcm-http-v1';
    this.fetcher = options.fetcher ?? fetch;
  }

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    if (notification.channel !== 'push') {
      throw new Error('PushProvider only supports push notifications');
    }

    const recipientValidation = await this.validateRecipient(
      notification.recipient,
    );

    if (!recipientValidation.valid) {
      throw new Error(recipientValidation.reason ?? 'Invalid FCM device token');
    }

    if (this.options.testMode === true) {
      return {
        externalId: `fcm-test-${notification.id}`,
        status: 'accepted',
        provider: this.providerName,
        rawResponse: {
          testMode: true,
          token: notification.recipient,
          notification: {
            title: notification.subject ?? 'Notification',
            body: notification.body,
          },
          data: notification.metadata ?? {},
        },
      };
    }

    const projectId = this.options.projectId;
    const accessToken = this.options.accessToken;

    if (projectId === undefined || accessToken === undefined) {
      throw new Error(
        'FCM projectId and accessToken are required outside test mode',
      );
    }

    const endpoint =
      `https://fcm.googleapis.com/v1/projects/` +
      `${encodeURIComponent(projectId)}/messages:send`;

    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: notification.recipient,
          notification: {
            title: notification.subject ?? 'Notification',
            body: notification.body,
          },
          data: this.convertMetadataToStringMap(notification.metadata),
        },
      }),
    });

    const payload = (await response.json()) as FcmResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `FCM request failed with status ${response.status}`,
      );
    }

    return {
      externalId: payload.name ?? `fcm-${notification.id}`,
      status: 'accepted',
      provider: this.providerName,
      rawResponse: payload,
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
          reason: 'FCM device token cannot be empty',
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
        message: 'Push provider is available in test mode',
      };
    }

    if (
      this.options.projectId === undefined ||
      this.options.accessToken === undefined
    ) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message: 'FCM projectId and accessToken are required for health checks',
      };
    }

    return {
      provider: this.providerName,
      healthy: true,
      checkedAt,
      message: 'FCM HTTP v1 configuration is present',
    };
  }

  private convertMetadataToStringMap(
    metadata: Record<string, unknown> | undefined,
  ): Record<string, string> {
    if (metadata === undefined) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]),
    );
  }
}
