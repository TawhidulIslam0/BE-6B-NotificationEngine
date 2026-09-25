import type Redis from 'ioredis';

/** Limits retry volume for a provider or notification class. */
export interface RetryBudgetConfig {
  windowMs: number;
  maxRetries: number;
}

/** Current consumption and availability of a retry budget. */
export interface RetryBudgetStatus {
  key: string;
  used: number;
  limit: number;
  remaining: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RetryBudgetConfig = {
  windowMs: 60_000,
  maxRetries: 1_000,
};

/** Tracks retry budget usage and rejects exhausted retry attempts. */
export class RetryBudgetMonitor {
  private readonly redis: Redis;
  private readonly config: RetryBudgetConfig;
  private readonly keyPrefix: string;

  public constructor(
    redis: Redis,
    config: Partial<RetryBudgetConfig> = {},
    keyPrefix = 'notification:retry:budget',
  ) {
    this.redis = redis;

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.keyPrefix = keyPrefix;
  }

  public getConfig(): RetryBudgetConfig {
    return {
      ...this.config,
    };
  }

  public getKey(windowStartMs: number): string {
    return `${this.keyPrefix}:${windowStartMs}`;
  }

  public async consume(
    retryCount = 1,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (!Number.isInteger(retryCount) || retryCount <= 0) {
      throw new Error('Retry count must be a positive integer');
    }

    const windowStartMs = this.getWindowStart(now);

    const key = this.getKey(windowStartMs);

    const current = await this.redis.incrby(key, retryCount);

    if (current === retryCount) {
      await this.redis.pexpire(key, this.config.windowMs);
    }

    return current <= this.config.maxRetries;
  }

  public async getStatus(now: Date = new Date()): Promise<RetryBudgetStatus> {
    const windowStartMs = this.getWindowStart(now);

    const key = this.getKey(windowStartMs);

    const value = await this.redis.get(key);

    const used = value ? Number(value) : 0;

    return {
      key,
      used,
      limit: this.config.maxRetries,
      remaining: Math.max(0, this.config.maxRetries - used),
      windowMs: this.config.windowMs,
    };
  }

  public async isAllowed(
    retryCount = 1,
    now: Date = new Date(),
  ): Promise<boolean> {
    const status = await this.getStatus(now);

    return status.used + retryCount <= status.limit;
  }

  private getWindowStart(now: Date): number {
    return (
      Math.floor(now.getTime() / this.config.windowMs) * this.config.windowMs
    );
  }
}

export { DEFAULT_CONFIG };
