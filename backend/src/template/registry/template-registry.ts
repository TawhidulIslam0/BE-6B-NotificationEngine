import type {
  Locale,
  TemplateDefinition,
  TemplateSelection,
  TemplateVariant,
} from '../types/template-types.js';

export class TemplateRegistry {
  private readonly templates = new Map<string, TemplateDefinition>();

  register(template: TemplateDefinition): void {
    const key = this.createKey(
      template.eventType,
      template.channel,
      template.locale,
      template.version,
      template.variant,
    );

    this.templates.set(key, template);
  }

  registerMany(templates: TemplateDefinition[]): void {
    for (const template of templates) {
      this.register(template);
    }
  }

  get(selection: TemplateSelection): TemplateDefinition {
    const version =
      selection.version ??
      this.getLatestVersion(
        selection.eventType,
        selection.channel,
        selection.locale,
      );

    const variant = selection.variant ?? 'A';

    const key = this.createKey(
      selection.eventType,
      selection.channel,
      selection.locale,
      version,
      variant,
    );

    const template = this.templates.get(key);

    if (!template) {
      throw new Error(`Template not found: ${key}`);
    }

    if (!template.active) {
      throw new Error(`Template is inactive: ${template.id}`);
    }

    return template;
  }

  has(selection: TemplateSelection): boolean {
    try {
      this.get(selection);
      return true;
    } catch {
      return false;
    }
  }

  list(): TemplateDefinition[] {
    return [...this.templates.values()];
  }

  getLatestVersion(
    eventType: string,
    channel: TemplateDefinition['channel'],
    locale: Locale,
  ): number {
    const matching = this.list().filter(
      (template) =>
        template.eventType === eventType &&
        template.channel === channel &&
        template.locale === locale &&
        template.active,
    );

    if (matching.length === 0) {
      throw new Error(
        `No active templates found for ${eventType}/${channel}/${locale}`,
      );
    }

    return Math.max(...matching.map((template) => template.version));
  }

  getVariant(
    eventType: string,
    channel: TemplateDefinition['channel'],
    locale: Locale,
    version: number,
    variant: TemplateVariant,
  ): TemplateDefinition {
    return this.get({
      eventType,
      channel,
      locale,
      version,
      variant,
    });
  }

  private createKey(
    eventType: string,
    channel: TemplateDefinition['channel'],
    locale: Locale,
    version: number,
    variant: TemplateVariant,
  ): string {
    return [eventType, channel, locale, `v${version}`, variant].join(':');
  }
}
