import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
} from '../providers/types.js';

import type { CircuitBreaker } from '../circuit-breaker/index.js';

export interface ProviderRoute {
  providerName: string;
  provider: DeliveryProvider;
  circuitBreaker: CircuitBreaker;
}

export interface ProviderAttempt {
  provider: string;
  success: boolean;
  responseTimeMs: number;
  error?: string;
}

export interface ProviderFailoverResult {
  receipt: DeliveryReceipt;
  provider: string;
  attempts: ProviderAttempt[];
  failedOver: boolean;
}

export interface ProviderFailoverConfig {
  channel: PreparedNotification['channel'];
  providers: ProviderRoute[];
}
