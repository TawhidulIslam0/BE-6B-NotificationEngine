import type { PreferencePatch } from './types.js';
import type { PreferenceService } from './service.js';

export interface HttpRequest {
  params: { id?: string };
  body?: unknown;
}

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
        const patch = request.body as PreferencePatch;
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
