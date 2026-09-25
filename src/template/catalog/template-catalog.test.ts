import { describe, expect, it } from 'vitest';
import { templateCatalog, templateCatalogStats } from './template-catalog.js';
import { createTemplateRegistry } from './template-catalog-loader.js';

describe('Template Catalog', () => {
  it('contains all 34 event types', () => {
    expect(templateCatalogStats.eventTypes).toBe(34);
  });

  it('generates templates for all configured locales', () => {
    expect(templateCatalogStats.locales).toBe(5);
  });

  it('generates templates for all seven channels', () => {
    expect(templateCatalogStats.channels).toBe(7);
  });

  it('generates A and B variants', () => {
    expect(templateCatalog.some((template) => template.variant === 'A')).toBe(
      true,
    );

    expect(templateCatalog.some((template) => template.variant === 'B')).toBe(
      true,
    );
  });

  it('supports registry lookup', () => {
    const registry = createTemplateRegistry();

    const template = registry.get({
      eventType: 'user.welcome',
      channel: 'email',
      locale: 'en',
      version: 1,
      variant: 'A',
    });

    expect(template.id).toBe('user.welcome.email.en.v1.A');
  });

  it('supports A/B variant selection', () => {
    const registry = createTemplateRegistry();

    const variantA = registry.getVariant('user.welcome', 'email', 'en', 1, 'A');

    const variantB = registry.getVariant('user.welcome', 'email', 'en', 1, 'B');

    expect(variantA.variant).toBe('A');
    expect(variantB.variant).toBe('B');
    expect(variantA.id).not.toBe(variantB.id);
  });

  it('throws for an unknown template', () => {
    const registry = createTemplateRegistry();

    expect(() =>
      registry.get({
        eventType: 'does.not.exist',
        channel: 'email',
        locale: 'en',
        version: 1,
        variant: 'A',
      }),
    ).toThrow();
  });
});
