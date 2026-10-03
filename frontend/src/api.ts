const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

type ApiErrorResponse = {
  message?: unknown;
  error?: unknown;
  details?: unknown;
  issues?: unknown;
};

export async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const text = await response.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    if (typeof data === 'object' && data !== null) {
      const errorData = data as ApiErrorResponse;

      if (typeof errorData.message === 'string') {
        throw new Error(errorData.message);
      }

      if (typeof errorData.error === 'string') {
        throw new Error(errorData.error);
      }

      if (errorData.details) {
        throw new Error(
          `Request failed (${response.status}): ${JSON.stringify(
            errorData.details,
            null,
            2,
          )}`,
        );
      }

      if (errorData.issues) {
        throw new Error(
          `Request failed (${response.status}): ${JSON.stringify(
            errorData.issues,
            null,
            2,
          )}`,
        );
      }
    }

    throw new Error(
      `Request failed (${response.status} ${response.statusText})`,
    );
  }

  return data as T;
}

export const endpoints = {
  health: () => api('/health'),

  ready: () => api('/ready'),

  live: () => api('/live'),

  providers: () => api('/health/providers'),

  metrics: () => api('/metrics'),

  sendEvent: (event: unknown) =>
    api('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }),

  deliveryRates: () => api('/analytics/delivery-rates'),

  channelPerformance: () => api('/analytics/channel-performance'),

  optOutTrends: () => api('/analytics/opt-out-trends'),

  costs: () => api('/analytics/costs'),

  dlq: () => api('/dlq'),

  retryDlq: (id: string) =>
    api(`/dlq/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    }),

  discardDlq: (id: string) =>
    api(`/dlq/${encodeURIComponent(id)}/discard`, {
      method: 'POST',
    }),

  preferences: (id: string) =>
    api(`/users/${encodeURIComponent(id)}/preferences`),

  updatePreferences: (id: string, value: unknown) =>
    api(`/users/${encodeURIComponent(id)}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(value),
    }),
};