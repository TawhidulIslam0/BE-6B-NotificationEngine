import Handlebars from 'handlebars';
import type {
  PersonalisationContext,
  RenderedTemplate,
  TemplateDefinition,
  TemplateRenderRequest,
} from '../types/template-types.js';
import { registerTemplateHelpers } from './helpers.js';
import { truncateSms } from './sms-formatter.js';

/** Renders localized templates and applies channel-specific formatting. */
export class TemplateEngine {
  private readonly handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    registerTemplateHelpers(this.handlebars);
  }

  /** Renders a template using the supplied personalization context. */
  render(
    template: TemplateDefinition,
    request: TemplateRenderRequest,
  ): RenderedTemplate {
    const context = this.flattenContext(request.context);

    const bodyTemplate = this.handlebars.compile(template.body, {
      strict: true,
    });

    let body = bodyTemplate(context);

    if (template.channel === 'sms') {
      body = truncateSms(body);
    }

    let subject: string | undefined;

    if (template.subject) {
      const subjectTemplate = this.handlebars.compile(template.subject, {
        strict: true,
      });

      subject = subjectTemplate(context);
    }

    return {
      templateId: template.id,
      eventType: template.eventType,
      channel: template.channel,
      locale: template.locale,
      version: template.version,
      variant: template.variant,
      subject,
      body,
    };
  }

  /** Returns required template fields missing from the rendering context. */
  validateContext(
    context: PersonalisationContext,
    requiredFields: string[],
  ): string[] {
    return requiredFields.filter(
      (field) => this.getField(context, field) === undefined,
    );
  }

  private flattenContext(
    context: PersonalisationContext,
  ): Record<string, unknown> {
    return {
      user: context.user,
      event: context.event,
      derived: context.derived,
    };
  }

  private getField(context: PersonalisationContext, path: string): unknown {
    const segments = path.split('.');

    let current: unknown = context;

    for (const segment of segments) {
      if (
        typeof current !== 'object' ||
        current === null ||
        !(segment in current)
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
