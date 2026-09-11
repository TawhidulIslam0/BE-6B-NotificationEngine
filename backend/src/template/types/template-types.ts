import type { Channel } from '../../events/routing/event-router';

export const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te'] as const;
export type Locale = (typeof supportedLocales)[number];

export type TemplateChannel = Channel;
export type TemplateVariant = 'A' | 'B';

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

export interface TemplateDefinition extends TemplateMetadata {
  body: string;
}

export interface TemplateSelection {
  eventType: string;
  channel: TemplateChannel;
  locale: Locale;
  version?: number;
  variant?: TemplateVariant;
}

export interface PersonalisationContext {
  user: Record<string, unknown>;
  event: Record<string, unknown>;
  derived: Record<string, unknown>;
}

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

export interface TemplateRenderRequest {
  selection: TemplateSelection;
  context: PersonalisationContext;
}

export interface TemplateValidationResult {
  valid: boolean;
  missingFields: string[];
}
