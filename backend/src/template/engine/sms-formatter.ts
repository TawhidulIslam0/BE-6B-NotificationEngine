const SMS_MAX_LENGTH = 160;

export function truncateSms(text: string, maxLength = SMS_MAX_LENGTH): string {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error('SMS maximum length must be a positive integer');
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return text.slice(0, maxLength);
  }

  const availableLength = maxLength - 3;
  const truncated = text.slice(0, availableLength).trimEnd();

  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > Math.floor(availableLength * 0.6)) {
    return `${truncated.slice(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

export function isSmsWithinLimit(
  text: string,
  maxLength = SMS_MAX_LENGTH,
): boolean {
  return text.length <= maxLength;
}
