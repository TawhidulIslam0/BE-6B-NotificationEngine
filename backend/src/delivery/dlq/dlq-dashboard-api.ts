import { Router } from 'express';

import type { DlqDashboardService } from './dlq-dashboard-service.js';

export const createDlqDashboardRouter = (
  service: DlqDashboardService,
): Router => {
  const router = Router();

  router.get('/dlq', async (req, res) => {
    try {
      const limit = parseOptionalInteger(req.query.limit);

      const offset = parseOptionalInteger(req.query.offset);

      const classification = parseClassification(req.query.classification);

      const status = parseStatus(req.query.status);

      const result = await service.list({
        limit,
        offset,
        classification,
        status,
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        error: getErrorMessage(error),
      });
    }
  });

  router.post('/dlq/:id/retry', async (req, res) => {
    try {
      const entry = await service.retry(req.params.id);

      res.status(200).json(entry);
    } catch (error) {
      res.status(404).json({
        error: getErrorMessage(error),
      });
    }
  });

  router.post('/dlq/:id/discard', async (req, res) => {
    try {
      const entry = await service.discard(req.params.id);

      res.status(200).json(entry);
    } catch (error) {
      res.status(404).json({
        error: getErrorMessage(error),
      });
    }
  });

  return router;
};

const parseOptionalInteger = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('Pagination values must be non-negative integers');
  }

  return Number(value);
};

const parseClassification = (
  value: unknown,
): 'transient' | 'permanent' | 'configuration' | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (
    value !== 'transient' &&
    value !== 'permanent' &&
    value !== 'configuration'
  ) {
    throw new Error('Invalid DLQ classification');
  }

  return value;
};

const parseStatus = (
  value: unknown,
): 'pending' | 'processing' | 'resolved' | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'pending' && value !== 'processing' && value !== 'resolved') {
    throw new Error('Invalid DLQ status');
  }

  return value;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
