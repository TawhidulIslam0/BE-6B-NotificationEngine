import { TemplateRegistry } from '../registry/template-registry.js';
import { templateCatalog } from './template-catalog.js';

export function createTemplateRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();

  registry.registerMany(templateCatalog);

  return registry;
}
