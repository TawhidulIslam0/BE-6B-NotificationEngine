import type { Knex } from 'knex';

/** Threshold and timing settings for DLQ alerting. */
export interface DlqAlertConfig {
  depthThreshold: number;
}

/** Alert emitted when DLQ volume or age exceeds configured limits. */
export interface DlqAlert {
  depth: number;
  threshold: number;
  message: string;
  triggeredAt: Date;
}

/** Sink used to publish DLQ alerts to operators. */
export interface DlqAlertNotifier {
  alert(alert: DlqAlert): Promise<void>;
}

const DEFAULT_CONFIG: DlqAlertConfig = {
  depthThreshold: 100,
};

/** Monitors dead-letter queue health and emits operator alerts. */
export class DlqAlertMonitor {
  private readonly db: Knex;
  private readonly config: DlqAlertConfig;
  private readonly notifier: DlqAlertNotifier;

  public constructor(
    db: Knex,
    notifier: DlqAlertNotifier,
    config: Partial<DlqAlertConfig> = {},
  ) {
    this.db = db;
    this.notifier = notifier;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  public getConfig(): DlqAlertConfig {
    return {
      ...this.config,
    };
  }

  public async getDepth(): Promise<number> {
    const result = await this.db('dead_letter_queue')
      .whereNot('status', 'resolved')
      .count<{ count: string }[]>({
        count: '*',
      })
      .first();

    return Number(result?.count ?? 0);
  }

  public async check(now: Date = new Date()): Promise<DlqAlert | null> {
    const depth = await this.getDepth();

    if (depth <= this.config.depthThreshold) {
      return null;
    }

    const alert: DlqAlert = {
      depth,
      threshold: this.config.depthThreshold,
      message:
        `DLQ depth ${depth} exceeds threshold ` +
        `${this.config.depthThreshold}`,
      triggeredAt: now,
    };

    await this.notifier.alert(alert);

    return alert;
  }
}
