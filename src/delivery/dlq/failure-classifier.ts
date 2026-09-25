import type { DlqClassification, DlqFailureContext } from './types.js';

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const PERMANENT_STATUS_CODES = new Set([400, 401, 403, 404, 410, 422]);

const TRANSIENT_ERROR_PATTERNS = [
  'timeout',
  'timed out',
  'network',
  'connection',
  'rate limit',
  'rate_limit',
  'temporarily unavailable',
  'service unavailable',
  'provider unavailable',
  'econnreset',
  'econnrefused',
  'etimedout',
];

const CONFIGURATION_ERROR_PATTERNS = [
  'api key',
  'api_key',
  'apikey',
  'configuration',
  'configured',
  'credential',
  'credentials',
  'missing environment',
  'environment variable',
  'apiurl is required',
];

const PERMANENT_ERROR_PATTERNS = [
  'invalid recipient',
  'invalid phone',
  'invalid email',
  'invalid token',
  'invalid argument',
  'malformed',
  'not found',
  'unsupported',
];

/** Maps provider failures to retry, DLQ, or permanent-failure policies. */
export class FailureClassifier {
  public classify(context: DlqFailureContext): DlqClassification {
    const message = this.getErrorMessage(context.error);

    const normalizedMessage = message.toLowerCase();

    if (this.isConfigurationError(normalizedMessage)) {
      return {
        classification: 'configuration',
        reason: message,
      };
    }

    if (
      context.statusCode !== undefined &&
      TRANSIENT_STATUS_CODES.has(context.statusCode)
    ) {
      return {
        classification: 'transient',
        reason: message,
      };
    }

    if (
      context.statusCode !== undefined &&
      PERMANENT_STATUS_CODES.has(context.statusCode)
    ) {
      return {
        classification: 'permanent',
        reason: message,
      };
    }

    if (this.matchesPattern(normalizedMessage, TRANSIENT_ERROR_PATTERNS)) {
      return {
        classification: 'transient',
        reason: message,
      };
    }

    if (this.matchesPattern(normalizedMessage, PERMANENT_ERROR_PATTERNS)) {
      return {
        classification: 'permanent',
        reason: message,
      };
    }

    return {
      classification: 'transient',
      reason: message,
    };
  }

  private isConfigurationError(message: string): boolean {
    return this.matchesPattern(message, CONFIGURATION_ERROR_PATTERNS);
  }

  private matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.some((pattern) => message.includes(pattern));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
