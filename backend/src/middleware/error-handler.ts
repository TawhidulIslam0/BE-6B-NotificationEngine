import type { NextFunction, Request, Response } from 'express';

import { ApplicationError } from '../errors/application-error.js';

import { logger } from '../logging/logger.js';

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next;

  if (error instanceof ApplicationError) {
    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          classification: error.classification,
          details: error.details,
        },
        method: request.method,
        path: request.originalUrl,
      },
      'Application error',
    );

    response.status(error.statusCode).json({
      status: 'error',
      classification: error.classification,
      message: error.message,
      details: error.details,
    });

    return;
  }

  logger.error(
    {
      error,
      method: request.method,
      path: request.originalUrl,
    },
    'Unhandled application error',
  );

  response.status(500).json({
    status: 'error',
    classification: 'permanent',
    message: 'Internal server error',
  });
}