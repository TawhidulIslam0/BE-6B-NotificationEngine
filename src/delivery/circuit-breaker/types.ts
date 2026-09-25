export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitBreakerThresholds {
  failureRateThreshold: number;
  responseTimeThresholdMs: number;
  minimumRequests: number;
  openStateDurationMs: number;
}

export interface CircuitBreakerSnapshot {
  provider: string;
  state: CircuitState;
  failureRate: number;
  averageResponseTimeMs: number;
  consecutiveFailures: number;
  lastFailureAt?: number;
  openedAt?: number;
}

export interface CircuitBreakerConfig {
  provider: string;
  thresholds: CircuitBreakerThresholds;
}
