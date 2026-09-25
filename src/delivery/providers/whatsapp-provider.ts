import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

/** Configuration for WhatsApp Cloud API delivery. */
export interface WhatsAppProviderOptions {
  providerName?: string;
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
  testMode?: boolean;

  /**
   * Injectable HTTP implementation for integration tests.
   */
  fetcher?: typeof fetch;
}

interface WhatsAppApiResponse {
  messages?: Array<{
    id?: string;
  }>;
  error?: {
    code?: number;
    type?: string;
    message?: string;
  };
}

/** Sends notifications through the WhatsApp provider. */
export class WhatsAppProvider implements DeliveryProvider {
  private readonly providerName: string;
  private readonly fetcher: typeof fetch;

  public constructor(private readonly options: WhatsAppProviderOptions = {}) {
    this.providerName = options.providerName ?? 'whatsapp-cloud-api';
    this.fetcher = options.fetcher ?? fetch;
  }

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    if (notification.channel !== 'whatsapp') {
      throw new Error('WhatsAppProvider only supports WhatsApp notifications');
    }

    const recipientValidation = await this.validateRecipient(
      notification.recipient,
    );

    if (!recipientValidation.valid) {
      throw new Error(
        recipientValidation.reason ?? 'Invalid WhatsApp recipient',
      );
    }

    if (this.options.testMode === true) {
      return {
        externalId: `whatsapp-test-${notification.id}`,
        status: 'accepted',
        provider: this.providerName,
        rawResponse: {
          testMode: true,
          recipient: notification.recipient,
          body: notification.body,
          metadata: notification.metadata ?? {},
        },
      };
    }

    const phoneNumberId = this.options.phoneNumberId;
    const accessToken = this.options.accessToken;

    if (phoneNumberId === undefined || accessToken === undefined) {
      throw new Error(
        'WhatsApp phoneNumberId and accessToken are required outside test mode',
      );
    }

    const apiVersion = this.options.apiVersion ?? 'v20.0';

    const endpoint =
      `https://graph.facebook.com/${apiVersion}/` +
      `${encodeURIComponent(phoneNumberId)}/messages`;

    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: notification.recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: notification.body,
        },
      }),
    });

    const payload = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `WhatsApp API request failed with status ${response.status}`,
      );
    }

    return {
      externalId: payload.messages?.[0]?.id ?? `whatsapp-${notification.id}`,
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
    const valid = /^\+[1-9]\d{7,14}$/.test(address.trim());

    return valid
      ? { valid: true }
      : {
          valid: false,
          reason:
            'WhatsApp recipient must use international phone format, for example +14155552671',
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
        message: 'WhatsApp provider is available in test mode',
      };
    }

    if (
      this.options.phoneNumberId === undefined ||
      this.options.accessToken === undefined
    ) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message:
          'WhatsApp phoneNumberId and accessToken are required for health checks',
      };
    }

    return {
      provider: this.providerName,
      healthy: true,
      checkedAt,
      message: 'WhatsApp Cloud API configuration is present',
    };
  }
}
