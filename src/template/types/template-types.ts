import type { Channel } from '../../events/routing/event-router';

/** Locales for which templates are supported. */
export const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te'] as const;
/** Supported template locale names. */
export type Locale = (typeof supportedLocales)[number];

/** Delivery channel used by a template. */
export type TemplateChannel = Channel;
/** A/B variant identifier for template experiments. */
export type TemplateVariant = 'A' | 'B';

/** Metadata required to identify and select a template. */
export interface TemplateMetadata {
  id: string;
  eventType: string;
  channel: TemplateChannel;
  locale: Locale;
  version: number;
  variant: TemplateVariant;
  subject?: string;
  requiredFields: string[];
  active: boolean;
}

/** Complete stored template, including its message body. */
export interface TemplateDefinition extends TemplateMetadata {
  body: string;
}

/** Criteria used to select a template for rendering. */
export interface TemplateSelection {
  eventType: string;
  channel: TemplateChannel;
  locale: Locale;
  version?: number;
  variant?: TemplateVariant;
}

/** Data namespaces available to template personalization. */
export interface PersonalisationContext {
  user: Record<string, unknown>;
  event: Record<string, unknown>;
  derived: Record<string, unknown>;
}

/** Template content after selection and personalization. */
export interface RenderedTemplate {
  templateId: string;
  eventType: string;
  channel: TemplateChannel;
  locale: Locale;
  version: number;
  variant: TemplateVariant;
  subject?: string;
  body: string;
}

/** Input to the template rendering service. */
export interface TemplateRenderRequest {
  selection: TemplateSelection;
  context: PersonalisationContext;
}

/** Result of checking template fields against a rendering context. */
export interface TemplateValidationResult {
  valid: boolean;
  missingFields: string[];
}
