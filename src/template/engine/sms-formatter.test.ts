import { describe, expect, it } from 'vitest';
import { isSmsWithinLimit, truncateSms } from './sms-formatter.js';

describe('SMS formatter', () => {
  it('does not modify short messages', () => {
    const message = 'Hello Tawhidul!';

    expect(truncateSms(message)).toBe(message);
  });

  it('limits messages to 160 characters', () => {
    const message = 'A'.repeat(300);

    const result = truncateSms(message);

    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('adds an ellipsis when truncating', () => {
    const message =
      'This is a very long notification message that needs to be shortened because SMS messages have a maximum length limit.';

    const result = truncateSms(message, 50);

    expect(result.endsWith('...')).toBe(true);
  });

  it('prefers a word boundary', () => {
    const message =
      'Hello this is a long notification message for our customer';

    const result = truncateSms(message, 40);

    expect(result).toBe('Hello this is a long notification...');
  });

  it('handles the minimum length', () => {
    expect(truncateSms('abcdef', 3)).toBe('abc');
  });

  it('rejects invalid limits', () => {
    expect(() => truncateSms('hello', 0)).toThrow();

    expect(() => truncateSms('hello', 2.5)).toThrow();
  });

  it('checks whether an SMS is within the limit', () => {
    expect(isSmsWithinLimit('A'.repeat(160))).toBe(true);

    expect(isSmsWithinLimit('A'.repeat(161))).toBe(false);
  });
});
