import type {
  CircuitBreakerConfig,
  CircuitBreakerSnapshot,
  CircuitState,
} from './types.js';

interface RequestSample {
  success: boolean;
  responseTimeMs: number;
  recordedAt: number;
}

/** Tracks provider failures and prevents calls while a provider is unhealthy. */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';

  private readonly samples: RequestSample[] = [];

  private consecutiveFailures = 0;

  private openedAt: number | undefined;

  private lastFailureAt: number | undefined;

  public constructor(private readonly config: CircuitBreakerConfig) {}

  /** Returns the current state, transitioning an expired open circuit if needed. */
  public getState(): CircuitState {
    this.refreshState();

    return this.state;
  }

  /** Indicates whether a request may be sent to the protected provider. */
  public canExecute(): boolean {
    this.refreshState();

    return this.state !== 'OPEN';
  }

  /** Records a successful call and may close a half-open circuit. */
  public recordSuccess(responseTimeMs: number): void {
    this.record({
      success: true,
      responseTimeMs,
      recordedAt: Date.now(),
    });

    this.consecutiveFailures = 0;

    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
      this.openedAt = undefined;

      // The successful recovery probe closes the circuit.
      // Clear the old failure history so it does not immediately
      // reopen the circuit.
      this.samples.length = 0;

      return;
    }

    this.evaluate();
  }

  /** Records a failed call and evaluates whether to open the circuit. */
  public recordFailure(responseTimeMs: number): void {
    const now = Date.now();

    this.record({
      success: false,
      responseTimeMs,
      recordedAt: now,
    });

    this.consecutiveFailures += 1;
    this.lastFailureAt = now;

    this.evaluate();
  }

  /** Returns diagnostic state and aggregate measurements for the breaker. */
  public snapshot(): CircuitBreakerSnapshot {
    this.refreshState();

    return {
      provider: this.config.provider,
      state: this.state,
      failureRate: this.failureRate(),
      averageResponseTimeMs: this.averageResponseTime(),
      consecutiveFailures: this.consecutiveFailures,
      ...(this.lastFailureAt === undefined
        ? {}
        : { lastFailureAt: this.lastFailureAt }),
      ...(this.openedAt === undefined ? {} : { openedAt: this.openedAt }),
    };
  }

  private record(sample: RequestSample): void {
    this.samples.push(sample);

    const maximumSamples = Math.max(
      this.config.thresholds.minimumRequests * 2,
      20,
    );

    while (this.samples.length > maximumSamples) {
      this.samples.shift();
    }
  }

  private refreshState(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== undefined &&
      Date.now() - this.openedAt >= this.config.thresholds.openStateDurationMs
    ) {
      this.state = 'HALF-OPEN';
    }
  }

  private evaluate(): void {
    if (this.state === 'OPEN') {
      return;
    }

    const minimumRequests = this.config.thresholds.minimumRequests;

    if (this.samples.length < minimumRequests) {
      return;
    }

    const failureRate = this.failureRate();
    const averageResponseTime = this.averageResponseTime();

    if (
      failureRate >= this.config.thresholds.failureRateThreshold ||
      averageResponseTime >= this.config.thresholds.responseTimeThresholdMs
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  private failureRate(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const failures = this.samples.filter((sample) => !sample.success).length;

    return failures / this.samples.length;
  }

  private averageResponseTime(): number {
    if (this.samples.length === 0) {
      return 0;
    }

    const total = this.samples.reduce(
      (sum, sample) => sum + sample.responseTimeMs,
      0,
    );

    return total / this.samples.length;
  }
}
