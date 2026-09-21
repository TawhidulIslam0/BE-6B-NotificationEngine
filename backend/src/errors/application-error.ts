export type ErrorClassification =
  | 'validation'
  | 'transient'
  | 'permanent';

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

export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    details?: unknown,
  ) {
    super(
      message,
      'validation',
      400,
      details,
    );

    this.name = 'ValidationError';
  }
}

export class TransientError extends ApplicationError {
  constructor(
    message: string,
    details?: unknown,
  ) {
    super(
      message,
      'transient',
      503,
      details,
    );

    this.name = 'TransientError';
  }
}

export class PermanentError extends ApplicationError {
  constructor(
    message: string,
    details?: unknown,
  ) {
    super(
      message,
      'permanent',
      500,
      details,
    );

    this.name = 'PermanentError';
  }
}