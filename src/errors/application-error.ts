/** Classification used to choose API responses and retry behavior. */
export type ErrorClassification = 'validation' | 'transient' | 'permanent';

/** Base error carrying a stable classification and HTTP status. */
export class ApplicationError extends Error {
  public readonly classification: ErrorClassification;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    classification: ErrorClassification,
    statusCode: number,
    details?: unknown,
  ) {
    super(message);

    this.name = 'ApplicationError';
    this.classification = classification;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Error for invalid client or event input. */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'validation', 400, details);

    this.name = 'ValidationError';
  }
}

/** Error indicating the operation may succeed when retried. */
export class TransientError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'transient', 503, details);

    this.name = 'TransientError';
  }
}

/** Error indicating retrying the operation will not help. */
export class PermanentError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'permanent', 500, details);

    this.name = 'PermanentError';
  }
}
