import { describe, expect, it } from 'vitest';

import { FailureClassifier } from './failure-classifier.js';

describe('FailureClassifier', () => {
  const classifier = new FailureClassifier();

  describe('transient failures', () => {
    it('classifies timeout errors as transient', () => {
      const result = classifier.classify({
        error: new Error('Provider request timeout'),
        retryCount: 3,
      });

      expect(result.classification).toBe('transient');

      expect(result.reason).toBe('Provider request timeout');
    });

    it('classifies rate-limit responses as transient', () => {
      const result = classifier.classify({
        error: new Error('SMS_RATE_LIMIT'),
        retryCount: 2,
        statusCode: 429,
      });

      expect(result.classification).toBe('transient');
    });

    it('classifies server errors as transient', () => {
      const result = classifier.classify({
        error: new Error('Provider unavailable'),
        retryCount: 5,
        statusCode: 503,
      });

      expect(result.classification).toBe('transient');
    });
  });

  describe('permanent failures', () => {
    it('classifies invalid recipients as permanent', () => {
      const result = classifier.classify({
        error: new Error('Invalid recipient'),
        retryCount: 2,
      });

      expect(result.classification).toBe('permanent');
    });

    it('classifies invalid arguments as permanent', () => {
      const result = classifier.classify({
        error: new Error('FCM_INVALID_ARGUMENT'),
        retryCount: 3,
        statusCode: 400,
      });

      expect(result.classification).toBe('permanent');
    });

    it('classifies unauthorized provider responses as permanent', () => {
      const result = classifier.classify({
        error: new Error('Unauthorized request'),
        retryCount: 2,
        statusCode: 401,
      });

      expect(result.classification).toBe('permanent');
    });
  });

  describe('configuration failures', () => {
    it('classifies missing API keys as configuration errors', () => {
      const result = classifier.classify({
        error: new Error('API key is missing'),
        retryCount: 0,
      });

      expect(result.classification).toBe('configuration');
    });

    it('classifies missing configuration as configuration errors', () => {
      const result = classifier.classify({
        error: new Error('apiUrl is required outside test mode'),
        retryCount: 0,
      });

      expect(result.classification).toBe('configuration');
    });
  });

  describe('unknown failures', () => {
    it('defaults unknown failures to transient', () => {
      const result = classifier.classify({
        error: new Error('Unexpected provider failure'),
        retryCount: 4,
      });

      expect(result.classification).toBe('transient');
    });

    it('handles string errors', () => {
      const result = classifier.classify({
        error: 'Connection reset',
        retryCount: 1,
      });

      expect(result.classification).toBe('transient');

      expect(result.reason).toBe('Connection reset');
    });

    it('handles non-Error unknown values', () => {
      const result = classifier.classify({
        error: {
          message: 'Provider unavailable',
        },
        retryCount: 1,
      });

      expect(result.classification).toBe('transient');
    });
  });
});
