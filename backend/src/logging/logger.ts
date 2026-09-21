import pino, { type Logger } from 'pino';

const environment = process.env.NODE_ENV ?? 'development';

const logLevel =
  process.env.LOG_LEVEL ?? (environment === 'production' ? 'info' : 'debug');

const logPretty = process.env.LOG_PRETTY === 'true';

export const logger: Logger = pino({
  level: logLevel,

  base: {
    service: 'notification-engine',
    environment,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  ...(logPretty
    ? {
        transport: {
          target: 'pino-pretty',

          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
      }
    : {}),
});
