import { createDefaultPreferences } from './defaults.js';
import type { RegulatoryOverride, UserPreferences } from './types.js';

export interface PreferenceLayers {
  segment?: Partial<UserPreferences>;
  user?: Partial<UserPreferences>;
  regulatory?: RegulatoryOverride;
}

function mergePreferences(
  base: UserPreferences,
  layer: Partial<UserPreferences> | RegulatoryOverride,
  source: UserPreferences['source'],
): UserPreferences {
  return {
    ...base,
    ...layer,
    channels: {
      ...base.channels,
      ...(layer.channels ?? {}),
    },
    categories: {
      ...base.categories,
      ...(layer.categories ?? {}),
    },
    source,
    updatedAt: new Date().toISOString(),
  };
}

export function resolvePreferences(
  userId: string,
  layers: PreferenceLayers = {},
): UserPreferences {
  let resolved = createDefaultPreferences(userId);

  if (layers.segment) {
    resolved = mergePreferences(resolved, layers.segment, 'segment');
  }

  if (layers.user) {
    resolved = mergePreferences(resolved, layers.user, 'user');
  }

  if (layers.regulatory) {
    resolved = mergePreferences(resolved, layers.regulatory, 'regulatory');
  }

  return resolved;
}
