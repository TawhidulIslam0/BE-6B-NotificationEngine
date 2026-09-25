import type {
  PersonalisationContext,
  TemplateDefinition,
  TemplateValidationResult,
} from '../types/template-types.js';

/** Checks template requirements against available personalization data. */
export class TemplateValidator {
  /** Returns missing required fields without throwing. */
  validate(
    template: TemplateDefinition,
    context: PersonalisationContext,
  ): TemplateValidationResult {
    const missingFields = template.requiredFields.filter(
      (field) => this.getField(context, field) === undefined,
    );

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /** Validates a template and throws when required fields are missing. */
  validateOrThrow(
    template: TemplateDefinition,
    context: PersonalisationContext,
  ): void {
    const result = this.validate(template, context);

    if (!result.valid) {
      throw new Error(
        `Missing required personalisation fields for template ${template.id}: ${result.missingFields.join(', ')}`,
      );
    }
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
