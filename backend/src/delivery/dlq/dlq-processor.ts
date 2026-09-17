import type { FailureClassifier } from './failure-classifier.js';

import type { DlqEntry, DlqFailureContext } from './types.js';

export interface DlqRepository {
  insert(entry: DlqEntry): Promise<void>;
}

export interface DlqProcessorResult {
  entry: DlqEntry;
  classification: 'transient' | 'permanent' | 'configuration';
  reason: string;
}

export class DlqProcessor {
  private readonly repository: DlqRepository;
  private readonly classifier: FailureClassifier;

  public constructor(repository: DlqRepository, classifier: FailureClassifier) {
    this.repository = repository;
    this.classifier = classifier;
  }

  public async processFailure(input: {
    eventId: string;
    eventType: string;
    payload: unknown;
    failure: DlqFailureContext;
  }): Promise<DlqProcessorResult> {
    const classification = this.classifier.classify(input.failure);

    const reason = `[${classification.classification}] ${classification.reason}`;

    const entry: DlqEntry = {
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
      reason,
      retryCount: input.failure.retryCount,
      status: 'pending',
      nextRetryAt: null,
    };

    await this.repository.insert(entry);

    return {
      entry,
      classification: classification.classification,
      reason,
    };
  }
}
