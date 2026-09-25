export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';

  private failureCount = 0;

  private openedAt?: number;

  public constructor(private readonly options: CircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than zero');
    }

    if (options.resetTimeoutMs <= 0) {
      throw new Error('resetTimeoutMs must be greater than zero');
    }
  }

  public getState(): CircuitState {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== undefined &&
      Date.now() - this.openedAt >= this.options.resetTimeoutMs
    ) {
      this.state = 'HALF_OPEN';
    }

    return this.state;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();

      this.recordSuccess();

      return result;
    } catch (error: unknown) {
      this.recordFailure();

      throw error;
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.openedAt = undefined;
  }

  private recordFailure(): void {
    this.failureCount += 1;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
