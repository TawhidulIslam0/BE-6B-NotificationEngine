import type { Logger } from 'pino';

export interface CorrelationContext {
  correlationId: string;
}

export function createCorrelationLogger(
  baseLogger: Logger,
  context: CorrelationContext,
): Logger {
  return baseLogger.child({
    correlationId: context.correlationId,
  });
}
