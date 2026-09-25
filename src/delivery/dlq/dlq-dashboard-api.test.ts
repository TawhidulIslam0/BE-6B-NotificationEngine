import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDlqDashboardRouter } from './dlq-dashboard-api.js';

import type { DlqDashboardService } from './dlq-dashboard-service.js';

import type { DlqEntry } from './types.js';

const createEntry = (overrides: Partial<DlqEntry> = {}): DlqEntry => ({
  id: 'dlq-id-1',
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'notification.email.send',
  payload: {
    userId: 'user-1',
  },
  reason: '[transient] Provider unavailable',
  retryCount: 3,
  status: 'pending',
  nextRetryAt: null,
  createdAt: new Date('2026-09-14T12:00:00Z'),
  resolvedAt: null,
  ...overrides,
});

describe('DLQ Dashboard API', () => {
  let service: {
    list: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    discard: ReturnType<typeof vi.fn>;
  };

  let app: express.Express;

  beforeEach(() => {
    service = {
      list: vi.fn(),
      retry: vi.fn(),
      discard: vi.fn(),
    };

    app = express();

    app.use(express.json());

    app.use(
      createDlqDashboardRouter(service as unknown as DlqDashboardService),
    );
  });

  describe('GET /dlq', () => {
    it('lists DLQ entries', async () => {
      const entry = createEntry();

      service.list.mockResolvedValue({
        entries: [entry],
        total: 1,
      });

      const response = await request(app).get('/dlq');

      expect(response.status).toBe(200);

      expect(response.body.total).toBe(1);

      expect(response.body.entries).toHaveLength(1);

      expect(response.body.entries[0].eventId).toBe(entry.eventId);

      expect(service.list).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        classification: undefined,
        status: undefined,
      });
    });

    it('passes pagination and filters to the service', async () => {
      service.list.mockResolvedValue({
        entries: [],
        total: 0,
      });

      const response = await request(app).get('/dlq').query({
        limit: 25,
        offset: 10,
        classification: 'transient',
        status: 'pending',
      });

      expect(response.status).toBe(200);

      expect(service.list).toHaveBeenCalledWith({
        limit: 25,
        offset: 10,
        classification: 'transient',
        status: 'pending',
      });
    });

    it('rejects an invalid classification', async () => {
      const response = await request(app).get('/dlq').query({
        classification: 'unknown',
      });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe('Invalid DLQ classification');

      expect(service.list).not.toHaveBeenCalled();
    });

    it('rejects an invalid pagination value', async () => {
      const response = await request(app).get('/dlq').query({
        limit: 'abc',
      });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Pagination values must be non-negative integers',
      );

      expect(service.list).not.toHaveBeenCalled();
    });

    it('rejects an invalid status', async () => {
      const response = await request(app).get('/dlq').query({
        status: 'failed',
      });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe('Invalid DLQ status');

      expect(service.list).not.toHaveBeenCalled();
    });
  });

  describe('POST /dlq/:id/retry', () => {
    it('retries a DLQ entry', async () => {
      const entry = createEntry({
        status: 'processing',
        nextRetryAt: new Date(),
      });

      service.retry.mockResolvedValue(entry);

      const response = await request(app).post('/dlq/dlq-id-1/retry');

      expect(response.status).toBe(200);

      expect(response.body.id).toBe('dlq-id-1');

      expect(response.body.status).toBe('processing');

      expect(service.retry).toHaveBeenCalledWith('dlq-id-1');
    });

    it('returns 404 when retry fails', async () => {
      service.retry.mockRejectedValue(
        new Error('DLQ entry not found or is not pending'),
      );

      const response = await request(app).post('/dlq/missing-id/retry');

      expect(response.status).toBe(404);

      expect(response.body.error).toBe('DLQ entry not found or is not pending');
    });
  });

  describe('POST /dlq/:id/discard', () => {
    it('discards a DLQ entry', async () => {
      const entry = createEntry({
        status: 'resolved',
        resolvedAt: new Date(),
      });

      service.discard.mockResolvedValue(entry);

      const response = await request(app).post('/dlq/dlq-id-1/discard');

      expect(response.status).toBe(200);

      expect(response.body.id).toBe('dlq-id-1');

      expect(response.body.status).toBe('resolved');

      expect(service.discard).toHaveBeenCalledWith('dlq-id-1');
    });

    it('returns 404 when discard fails', async () => {
      service.discard.mockRejectedValue(
        new Error('DLQ entry not found or is already resolved'),
      );

      const response = await request(app).post('/dlq/missing-id/discard');

      expect(response.status).toBe(404);

      expect(response.body.error).toBe(
        'DLQ entry not found or is already resolved',
      );
    });
  });
});
