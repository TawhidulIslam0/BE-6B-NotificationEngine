import { TemplateRegistry } from '../registry/template-registry.js';
import { templateCatalog } from './template-catalog.js';

/** Creates a registry populated with the built-in template catalog. */
export function createTemplateRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();

  registry.registerMany(templateCatalog);

  return registry;
}
