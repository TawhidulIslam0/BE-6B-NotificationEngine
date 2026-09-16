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

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';

  private readonly samples: RequestSample[] = [];

  private consecutiveFailures = 0;

  private openedAt: number | undefined;

  private lastFailureAt: number | undefined;

  public constructor(private readonly config: CircuitBreakerConfig) {}

  public getState(): CircuitState {
    this.refreshState();

    return this.state;
  }

  public canExecute(): boolean {
    this.refreshState();

    return this.state !== 'OPEN';
  }

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
