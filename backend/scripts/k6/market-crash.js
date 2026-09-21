import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    market_crash: {
      executor: 'constant-arrival-rate',
      rate: 480,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
    },
  },
};

export default function () {
  const eventId = `k6-crash-${__VU}-${__ITER}-${Date.now()}`;
  const correlationId = `k6-correlation-crash-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    event_id: eventId,
    event_type: 'user.welcome',
    event_version: '1.0',
    occurred_at: new Date().toISOString(),
    user_id: 'a96c5488-74ea-449f-a09e-2efad789dca7',
    correlation_id: correlationId,
    source: 'k6',
    priority: 'normal',
    payload: {
      name: 'k6 Benchmark User',
    },
  });

  const response = http.post(`${BASE_URL}/api/v1/events`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'status is 202': (r) => r.status === 202,
  });
}

