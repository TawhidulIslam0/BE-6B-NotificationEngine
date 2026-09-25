import type { PreferencePatch } from './types.js';
import type { PreferenceService } from './service.js';
import { preferencePatchSchema } from './validation.js';

/** Minimal request shape consumed by preference handlers. */
export interface HttpRequest {
  params: { id?: string };
  body?: unknown;
}

/** Minimal response shape produced by preference handlers. */
export interface HttpResponse {
  status(code: number): {
    json(payload: unknown): void;
  };
  json(payload: unknown): void;
}

function requireUserId(request: HttpRequest): string {
  const userId = request.params.id;

  if (!userId) {
    throw new Error('User id is required');
  }

  return userId;
}

/** Creates HTTP handlers for reading and updating user preferences. */
export function createPreferenceHandlers(service: PreferenceService) {
  return {
    get: async (
      request: HttpRequest,
      response: HttpResponse,
    ): Promise<void> => {
      try {
        const preferences = await service.get(requireUserId(request));
        response.json(preferences);
      } catch (error) {
        response.status(404).json({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load preferences',
        });
      }
    },

    put: async (
      request: HttpRequest,
      response: HttpResponse,
    ): Promise<void> => {
      try {
        const parsed = preferencePatchSchema.safeParse(request.body);

        if (!parsed.success) {
          response.status(400).json({
            error: 'Invalid preference payload',
            details: parsed.error.issues,
          });
          return;
        }

        const patch = parsed.data as PreferencePatch;
        const preferences = await service.update(requireUserId(request), patch);

        response.json(preferences);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to update preferences',
        });
      }
    },
  };
}
