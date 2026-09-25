import type {
  TemplateDefinition,
  TemplateVariant,
} from '../types/template-types.js';

const locales = ['en', 'hi', 'mr', 'ta', 'te'] as const;

const channels = [
  'sms',
  'email',
  'push',
  'whatsapp',
  'in-app',
  'ivr',
  'webhook',
] as const;

type CatalogChannel = (typeof channels)[number];
type CatalogLocale = (typeof locales)[number];

interface EventTemplateConfig {
  eventType: string;
  requiredFields: string[];
  subject: string;
  body: string;
}

const eventTemplates: EventTemplateConfig[] = [
  {
    eventType: 'user.registered',
    requiredFields: ['user.firstName'],
    subject: 'Welcome to our service',
    body: 'Welcome, {{user.firstName}}! Your account has been created successfully.',
  },
  {
    eventType: 'user.welcome',
    requiredFields: ['user.firstName'],
    subject: 'Welcome {{user.firstName}}',
    body: 'Welcome {{user.firstName}}! We are happy to have you with us.',
  },
  {
    eventType: 'user.email_verified',
    requiredFields: ['user.email'],
    subject: 'Email verified',
    body: 'Your email address {{user.email}} has been successfully verified.',
  },
  {
    eventType: 'user.phone_verified',
    requiredFields: ['user.phone'],
    subject: 'Phone verified',
    body: 'Your phone number has been successfully verified.',
  },
  {
    eventType: 'user.password_changed',
    requiredFields: ['user.firstName'],
    subject: 'Password changed',
    body: 'Hello {{user.firstName}}, your password was successfully changed.',
  },
  {
    eventType: 'user.password_reset_requested',
    requiredFields: ['user.firstName'],
    subject: 'Password reset requested',
    body: 'Hello {{user.firstName}}, we received a request to reset your password.',
  },
  {
    eventType: 'user.login_new_device',
    requiredFields: ['user.firstName'],
    subject: 'New device login detected',
    body: 'Hello {{user.firstName}}, a login to your account was detected from a new device.',
  },
  {
    eventType: 'user.account_locked',
    requiredFields: ['user.firstName'],
    subject: 'Account locked',
    body: 'Hello {{user.firstName}}, your account has been locked for security reasons.',
  },
  {
    eventType: 'user.account_unlocked',
    requiredFields: ['user.firstName'],
    subject: 'Account unlocked',
    body: 'Hello {{user.firstName}}, your account has been unlocked.',
  },

  {
    eventType: 'transaction.created',
    requiredFields: [
      'user.firstName',
      'event.payload.transaction_id',
      'event.payload.amount',
      'event.payload.currency',
    ],
    subject: 'Transaction created',
    body: 'Hello {{user.firstName}}, transaction {{event.payload.transaction_id}} for {{currency event.payload.amount event.payload.currency "en-US"}} has been created.',
  },
  {
    eventType: 'transaction.completed',
    requiredFields: [
      'user.firstName',
      'event.payload.transaction_id',
      'event.payload.amount',
      'event.payload.currency',
    ],
    subject: 'Transaction completed',
    body: 'Hello {{user.firstName}}, transaction {{event.payload.transaction_id}} for {{currency event.payload.amount event.payload.currency "en-US"}} was completed successfully.',
  },
  {
    eventType: 'transaction.failed',
    requiredFields: ['user.firstName', 'event.payload.transaction_id'],
    subject: 'Transaction failed',
    body: 'Hello {{user.firstName}}, transaction {{event.payload.transaction_id}} could not be completed.',
  },
  {
    eventType: 'transaction.reversed',
    requiredFields: ['user.firstName', 'event.payload.transaction_id'],
    subject: 'Transaction reversed',
    body: 'Hello {{user.firstName}}, transaction {{event.payload.transaction_id}} has been reversed.',
  },

  {
    eventType: 'payment.received',
    requiredFields: [
      'user.firstName',
      'event.payload.amount',
      'event.payload.currency',
    ],
    subject: 'Payment received',
    body: 'Hello {{user.firstName}}, your payment of {{currency event.payload.amount event.payload.currency "en-US"}} has been received.',
  },
  {
    eventType: 'payment.failed',
    requiredFields: ['user.firstName'],
    subject: 'Payment failed',
    body: 'Hello {{user.firstName}}, your payment could not be processed.',
  },
  {
    eventType: 'payment.refunded',
    requiredFields: [
      'user.firstName',
      'event.payload.amount',
      'event.payload.currency',
    ],
    subject: 'Payment refunded',
    body: 'Hello {{user.firstName}}, your payment of {{currency event.payload.amount event.payload.currency "en-US"}} has been refunded.',
  },

  {
    eventType: 'order.created',
    requiredFields: ['user.firstName', 'event.payload.order_id'],
    subject: 'Order created',
    body: 'Hello {{user.firstName}}, your order {{event.payload.order_id}} has been created.',
  },
  {
    eventType: 'order.confirmed',
    requiredFields: ['user.firstName', 'event.payload.order_id'],
    subject: 'Order confirmed',
    body: 'Hello {{user.firstName}}, your order {{event.payload.order_id}} has been confirmed.',
  },
  {
    eventType: 'order.shipped',
    requiredFields: ['user.firstName', 'event.payload.order_id'],
    subject: 'Order shipped',
    body: 'Hello {{user.firstName}}, your order {{event.payload.order_id}} has been shipped.',
  },
  {
    eventType: 'order.delivered',
    requiredFields: ['user.firstName', 'event.payload.order_id'],
    subject: 'Order delivered',
    body: 'Hello {{user.firstName}}, your order {{event.payload.order_id}} has been delivered.',
  },
  {
    eventType: 'order.cancelled',
    requiredFields: ['user.firstName', 'event.payload.order_id'],
    subject: 'Order cancelled',
    body: 'Hello {{user.firstName}}, your order {{event.payload.order_id}} has been cancelled.',
  },

  {
    eventType: 'subscription.started',
    requiredFields: ['user.firstName'],
    subject: 'Subscription started',
    body: 'Hello {{user.firstName}}, your subscription has started successfully.',
  },
  {
    eventType: 'subscription.renewal_due',
    requiredFields: ['user.firstName'],
    subject: 'Subscription renewal due',
    body: 'Hello {{user.firstName}}, your subscription is due for renewal soon.',
  },
  {
    eventType: 'subscription.renewed',
    requiredFields: ['user.firstName'],
    subject: 'Subscription renewed',
    body: 'Hello {{user.firstName}}, your subscription has been successfully renewed.',
  },
  {
    eventType: 'subscription.cancelled',
    requiredFields: ['user.firstName'],
    subject: 'Subscription cancelled',
    body: 'Hello {{user.firstName}}, your subscription has been cancelled.',
  },
  {
    eventType: 'subscription.payment_failed',
    requiredFields: ['user.firstName'],
    subject: 'Subscription payment failed',
    body: 'Hello {{user.firstName}}, your subscription payment could not be processed.',
  },

  {
    eventType: 'security.suspicious_activity',
    requiredFields: ['user.firstName'],
    subject: 'Suspicious activity detected',
    body: 'Hello {{user.firstName}}, suspicious activity was detected on your account. Please review your account immediately.',
  },
  {
    eventType: 'security.mfa_enabled',
    requiredFields: ['user.firstName'],
    subject: 'MFA enabled',
    body: 'Hello {{user.firstName}}, multi-factor authentication has been enabled on your account.',
  },
  {
    eventType: 'security.mfa_disabled',
    requiredFields: ['user.firstName'],
    subject: 'MFA disabled',
    body: 'Hello {{user.firstName}}, multi-factor authentication has been disabled on your account.',
  },

  {
    eventType: 'promotion.available',
    requiredFields: ['user.firstName'],
    subject: 'New offer available',
    body: 'Hello {{user.firstName}}, a new offer is available for you.',
  },
  {
    eventType: 'promotion.expiring',
    requiredFields: ['user.firstName'],
    subject: 'Offer expiring soon',
    body: 'Hello {{user.firstName}}, your offer is expiring soon.',
  },

  {
    eventType: 'system.maintenance_scheduled',
    requiredFields: ['user.firstName', 'event.occurred_at'],
    subject: 'Maintenance scheduled',
    body: 'Hello {{user.firstName}}, system maintenance is scheduled for {{date event.occurred_at "en-US"}}.',
  },
  {
    eventType: 'system.maintenance_started',
    requiredFields: ['user.firstName'],
    subject: 'Maintenance started',
    body: 'Hello {{user.firstName}}, scheduled system maintenance has started.',
  },
  {
    eventType: 'system.maintenance_completed',
    requiredFields: ['user.firstName'],
    subject: 'Maintenance completed',
    body: 'Hello {{user.firstName}}, system maintenance has been completed.',
  },
];

function localiseText(text: string, locale: CatalogLocale): string {
  if (locale === 'en') {
    return text;
  }

  const prefixes: Record<CatalogLocale, string> = {
    en: '',
    hi: 'नमस्ते {{user.firstName}}, ',
    mr: 'नमस्कार {{user.firstName}}, ',
    ta: 'வணக்கம் {{user.firstName}}, ',
    te: 'నమస్కారం {{user.firstName}}, ',
  };

  const prefix = prefixes[locale];

  return text.startsWith('Hello {{user.firstName}}, ')
    ? text.replace('Hello {{user.firstName}}, ', prefix)
    : text;
}

function createTemplate(
  config: EventTemplateConfig,
  channel: CatalogChannel,
  locale: CatalogLocale,
  version: number,
  variant: TemplateVariant,
): TemplateDefinition {
  const suffix =
    variant === 'A' ? '' : ' We are here to help if you need anything else.';

  return {
    id: `${config.eventType}.${channel}.${locale}.v${version}.${variant}`,
    eventType: config.eventType,
    channel,
    locale,
    version,
    variant,
    subject: localiseText(config.subject, locale),
    body: `${localiseText(config.body, locale)}${suffix}`,
    requiredFields: config.requiredFields,
    active: true,
  };
}

/** Builds the built-in notification template definitions. */
export function buildTemplateCatalog(): TemplateDefinition[] {
  const templates: TemplateDefinition[] = [];

  for (const config of eventTemplates) {
    for (const channel of channels) {
      for (const locale of locales) {
        templates.push(createTemplate(config, channel, locale, 1, 'A'));

        templates.push(createTemplate(config, channel, locale, 1, 'B'));
      }
    }
  }

  return templates;
}

export const templateCatalog = buildTemplateCatalog();

export const templateCatalogStats = {
  eventTypes: eventTemplates.length,
  locales: locales.length,
  channels: channels.length,
  templates: templateCatalog.length,
};
