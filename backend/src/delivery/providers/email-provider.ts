import nodemailer from 'nodemailer';
import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

type EmailTransporter = ReturnType<typeof nodemailer.createTransport>;

export interface EmailProviderOptions {
  providerName?: string;
  testMode?: boolean;

  /**
   * When true, create an Ethereal test account automatically.
   * The generated preview URL is returned in the delivery receipt.
   */
  useEthereal?: boolean;

  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromAddress?: string;

  transporter?: EmailTransporter;
}

export class EmailProvider implements DeliveryProvider {
  private readonly providerName: string;
  private readonly options: EmailProviderOptions;
  private readonly transporter: EmailTransporter | undefined;
  private readonly fromAddress: string | undefined;

  public constructor(options: EmailProviderOptions = {}) {
    this.options = options;
    this.providerName = options.providerName ?? 'email-test-provider';
    this.fromAddress = options.fromAddress ?? options.username;

    if (options.transporter !== undefined) {
      this.transporter = options.transporter;
      return;
    }

    if (options.testMode === true) {
      return;
    }

    if (
      options.host === undefined ||
      options.username === undefined ||
      options.password === undefined
    ) {
      throw new Error(
        'Email SMTP host, username, and password are required outside test mode',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port ?? 587,
      secure: options.secure ?? false,
      auth: {
        user: options.username,
        pass: options.password,
      },
    });
  }

  /**
   * Creates an EmailProvider using an automatically generated
   * Ethereal test SMTP account.
   */
  public static async createEthereal(
    options: Omit<
      EmailProviderOptions,
      | 'transporter'
      | 'host'
      | 'port'
      | 'secure'
      | 'username'
      | 'password'
      | 'testMode'
    > = {},
  ): Promise<EmailProvider> {
    const account = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    return new EmailProvider({
      ...options,
      providerName: options.providerName ?? 'ethereal-email-provider',
      transporter,
      username: account.user,
      fromAddress: options.fromAddress ?? account.user,
      testMode: false,
    });
  }

  public async send(
    notification: PreparedNotification,
  ): Promise<DeliveryReceipt> {
    if (notification.channel !== 'email') {
      throw new Error('EmailProvider only supports email notifications');
    }

    if (this.options.testMode === true) {
      return {
        externalId: `email-test-${notification.id}`,
        status: 'accepted',
        provider: this.providerName,
        rawResponse: {
          testMode: true,
          recipient: notification.recipient,
          subject: notification.subject ?? 'Notification',
          body: notification.body,
        },
      };
    }

    if (this.transporter === undefined) {
      throw new Error('Email transporter is not configured');
    }

    if (this.fromAddress === undefined) {
      throw new Error('Email sender address is not configured');
    }

    const result = await this.transporter.sendMail({
      from: this.fromAddress,
      to: notification.recipient,
      subject: notification.subject ?? 'Notification',
      text: notification.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(result);

    return {
      externalId: result.messageId,
      status: 'accepted',
      provider: this.providerName,
      rawResponse: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response,
        previewUrl: previewUrl ?? undefined,
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
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

    return valid
      ? { valid: true }
      : {
          valid: false,
          reason: 'Email recipient must be a valid email address',
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
        message: 'Email provider is available in test mode',
      };
    }

    if (this.transporter === undefined) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message: 'Email transporter is not configured',
      };
    }

    try {
      await this.transporter.verify();

      return {
        provider: this.providerName,
        healthy: true,
        checkedAt,
        message: 'Email SMTP connection is healthy',
      };
    } catch (error: unknown) {
      return {
        provider: this.providerName,
        healthy: false,
        checkedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Email SMTP health check failed',
      };
    }
  }
}
