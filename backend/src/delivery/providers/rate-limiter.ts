export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class ProviderRateLimiter {
  private requestTimestamps: number[] = [];

  public constructor(private readonly options: RateLimiterOptions) {
    if (options.maxRequests <= 0) {
      throw new Error('maxRequests must be greater than zero');
    }

    if (options.windowMs <= 0) {
      throw new Error('windowMs must be greater than zero');
    }
  }

  public async waitForSlot(): Promise<void> {
    this.removeExpiredRequests();

    if (this.requestTimestamps.length < this.options.maxRequests) {
      this.requestTimestamps.push(Date.now());
      return;
    }

    const oldestRequest = this.requestTimestamps[0];

    if (oldestRequest === undefined) {
      this.requestTimestamps.push(Date.now());
      return;
    }

    const waitTime = this.options.windowMs - (Date.now() - oldestRequest);

    if (waitTime > 0) {
      await this.sleep(waitTime);
    }

    this.removeExpiredRequests();
    this.requestTimestamps.push(Date.now());
  }

  private removeExpiredRequests(): void {
    const cutoff = Date.now() - this.options.windowMs;

    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > cutoff,
    );
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }
}
