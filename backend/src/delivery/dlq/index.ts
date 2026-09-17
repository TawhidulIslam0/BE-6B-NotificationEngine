export { FailureClassifier } from './failure-classifier.js';

export { DlqProcessor } from './dlq-processor.js';

export { DlqPostgresRepository } from './dlq-postgres-repository.js';

export type { DlqRepository, DlqProcessorResult } from './dlq-processor.js';

export type {
  DlqClassification,
  DlqEntry,
  DlqFailureClassification,
  DlqFailureContext,
} from './types.js';
