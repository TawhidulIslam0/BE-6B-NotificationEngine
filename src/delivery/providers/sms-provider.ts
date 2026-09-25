import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

/** Configuration for the SMS provider and injectable HTTP transport. */
export interface SmsProviderOptions {
  apiUrl?: string;
  apiKey?: string;
  providerName?: string;
  testMode?: boolean;
}

interface SmsApiResponse {
  messageId?: string;
  status?: string;
  error?: string;
}

/** Sends SMS notifications through the configured provider endpoint. */
export class SmsProvider implements DeliveryProvider {
  private readonly providerName: string;

  public constructor(private readonly options: SmsProviderOptions = {}) {
    this.providerName = options.providerName ?? 'sms-test-provider';
  }

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    if (notification.channel !== 'sms') {
      throw new Error('SmsProvider only supports SMS notifications');
    }

    if (this.options.testMode === true) {
      return {
        externalId: `sms-test-${notification.id}`,
        status: 'accepted',
        provider: this.providerName,
        rawResponse: {
          testMode: true,
          recipient: notification.recipient,
          body: notification.body,
        },
      };
    }

    if (this.options.apiUrl === undefined) {
      throw new Error('apiUrl is required outside test mode');
    }

    const response = await fetch(this.options.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.apiKey === undefined
          ? {}
          : { Authorization: `Bearer ${this.options.apiKey}` }),
      },
      body: JSON.stringify({
        to: notification.recipient,
        message: notification.body,
      }),
    });

    const payload = (await response.json()) as SmsApiResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? 'SMS provider request failed');
    }

    return {
      externalId: payload.messageId ?? `sms-${notification.id}`,
      status: 'accepted',
      provider: this.providerName,
      rawResponse: payload,
    };
  }

  public async getStatus(externalId: string): Promise<DeliveryReceipt> {
    if (this.options.testMode === true) {
      return {
        externalId,
        status: 'delivered',
        provider: this.providerName,
      };
    }

    throw new Error('SMS status endpoint is not configured');
  }

  public async validateRecipient(
    address: string,
  ): Promise<RecipientValidationResult> {
    const valid = /^\+[1-9]\d{7,14}$/.test(address);

    return valid
      ? { valid: true }
      : {
          valid: false,
          reason: 'SMS recipient must use international E.164 format',
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
        message: 'SMS provider is available in test mode',
      };
    }

    if (this.options.apiUrl === undefined) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message: 'SMS provider API URL is not configured',
      };
    }

    return {
      provider: this.providerName,
      healthy: true,
      checkedAt,
      message: 'SMS provider configuration is present',
    };
  }
}
