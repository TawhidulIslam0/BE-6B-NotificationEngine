import type { EventEnvelope } from '../../events/types/events.js';
import type {
  Locale,
  PersonalisationContext,
  RenderedTemplate,
  TemplateRenderRequest,
  TemplateSelection,
} from '../types/template-types.js';
import { TemplateEngine } from '../engine/template-engine.js';
import { TemplateRegistry } from '../registry/template-registry.js';
import { TemplateValidator } from '../validation/template-validator.js';

/** User fields exposed to template personalization. */
export interface PersonalisationUser {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
}

/** Result of resolving personalization data for an event. */
export interface PersonalisationResult {
  context: PersonalisationContext;
  rendered: RenderedTemplate;
}

const supportedLocales: Locale[] = ['en', 'hi', 'mr', 'ta', 'te'];

function resolveLocale(userLocale?: string): Locale {
  if (userLocale && supportedLocales.includes(userLocale as Locale)) {
    return userLocale as Locale;
  }

  return 'en';
}

/** Builds the user, event, and derived context used by templates. */
export class PersonalisationPipeline {
  constructor(
    private readonly registry: TemplateRegistry,
    private readonly engine: TemplateEngine = new TemplateEngine(),
    private readonly validator: TemplateValidator = new TemplateValidator(),
  ) {}

  async process(
    event: EventEnvelope,
    user: PersonalisationUser,
    selection: TemplateSelection,
  ): Promise<PersonalisationResult> {
    const context = this.buildContext(event, user);

    const resolvedSelection: TemplateSelection = {
      ...selection,
      locale: selection.locale ?? resolveLocale(user.locale),
    };

    const template = this.registry.get(resolvedSelection);

    this.validator.validateOrThrow(template, context);

    const request: TemplateRenderRequest = {
      selection: resolvedSelection,
      context,
    };

    const rendered = this.engine.render(template, request);

    return {
      context,
      rendered,
    };
  }

  private buildContext(
    event: EventEnvelope,
    user: PersonalisationUser,
  ): PersonalisationContext {
    const fullName =
      user.fullName ??
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    const derived: Record<string, unknown> = {
      fullName,
      firstName: user.firstName ?? fullName.split(' ')[0] ?? '',
      currentYear: new Date().getFullYear(),
      eventType: event.event_type,
      eventId: event.event_id,
      occurredAt: event.occurred_at,
      priority: event.priority,
    };

    return {
      user: {
        ...user,
        fullName,
      },
      event: event as unknown as Record<string, unknown>,
      derived,
    };
  }
}
