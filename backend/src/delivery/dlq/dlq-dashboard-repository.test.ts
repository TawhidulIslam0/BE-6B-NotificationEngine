import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DlqDashboardRepository,
  type DlqListOptions,
} from './dlq-dashboard-repository.js';

interface QueryBuilderMock {
  where: ReturnType<typeof vi.fn>;
  whereNot: ReturnType<typeof vi.fn>;
  clone: ReturnType<typeof vi.fn>;
  clearSelect: ReturnType<typeof vi.fn>;
  clearOrder: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

const createQueryBuilder = (): QueryBuilderMock => {
  const builder = {} as QueryBuilderMock;

  builder.where = vi.fn().mockReturnValue(builder);

  builder.whereNot = vi.fn().mockReturnValue(builder);

  builder.clone = vi.fn();

  builder.clearSelect = vi.fn().mockReturnValue(builder);

  builder.clearOrder = vi.fn().mockReturnValue(builder);

  builder.count = vi.fn().mockReturnValue(builder);

  builder.first = vi.fn().mockResolvedValue(undefined);

  builder.select = vi.fn().mockReturnValue(builder);

  builder.orderBy = vi.fn().mockReturnValue(builder);

  builder.limit = vi.fn().mockReturnValue(builder);

  builder.offset = vi.fn().mockResolvedValue([]);

  builder.update = vi.fn().mockReturnValue(builder);

  builder.returning = vi.fn().mockResolvedValue([]);

  return builder;
};

const createRow = (
  overrides: Partial<{
    id: string;
    event_id: string;
    event_type: string;
    payload: unknown;
    reason: string;
    retry_count: number;
    status: string;
    next_retry_at: Date | null;
    created_at: Date;
    resolved_at: Date | null;
  }> = {},
) => ({
  id: 'dlq-id-1',
  event_id: '11111111-1111-4111-8111-111111111111',
  event_type: 'notification.email.send',
  payload: {
    userId: 'user-1',
  },
  reason: '[transient] Provider unavailable',
  retry_count: 3,
  status: 'pending',
  next_retry_at: null,
  created_at: new Date('2026-09-14T12:00:00Z'),
  resolved_at: null,
  ...overrides,
});

const configureListQuery = (
  baseQuery: QueryBuilderMock,
  rows: ReturnType<typeof createRow>[],
  total: number,
) => {
  const countQuery = createQueryBuilder();

  const rowsQuery = createQueryBuilder();

  countQuery.first = vi.fn().mockResolvedValue({
    count: String(total),
  });

  rowsQuery.offset = vi.fn().mockResolvedValue(rows);

  baseQuery.clone
    .mockReturnValueOnce(countQuery)
    .mockReturnValueOnce(rowsQuery);

  return {
    countQuery,
    rowsQuery,
  };
};

describe('DlqDashboardRepository', () => {
  let builder: QueryBuilderMock;
  let db: ReturnType<typeof vi.fn>;
  let repository: DlqDashboardRepository;

  beforeEach(() => {
    builder = createQueryBuilder();

    db = vi.fn().mockReturnValue(builder);

    repository = new DlqDashboardRepository(db as never);
  });

  it('lists DLQ entries with pagination', async () => {
    const row = createRow();

    const { rowsQuery } = configureListQuery(builder, [row], 1);

    const result = await repository.list({
      limit: 10,
      offset: 20,
    });

    expect(result.total).toBe(1);

    expect(result.entries).toHaveLength(1);

    expect(result.entries[0]).toMatchObject({
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      reason: row.reason,
      retryCount: row.retry_count,
      status: 'pending',
    });

    expect(rowsQuery.limit).toHaveBeenCalledWith(10);

    expect(rowsQuery.offset).toHaveBeenCalledWith(20);
  });

  it('filters by classification', async () => {
    const row = createRow({
      reason: '[permanent] Invalid recipient',
    });

    configureListQuery(builder, [row], 1);

    await repository.list({
      classification: 'permanent',
    });

    expect(builder.where).toHaveBeenCalledWith(
      'reason',
      'like',
      '[permanent]%',
    );
  });

  it('filters by status', async () => {
    configureListQuery(builder, [], 0);

    await repository.list({
      status: 'processing',
    });

    expect(builder.where).toHaveBeenCalledWith('status', 'processing');
  });

  it('uses safe pagination defaults and maximum limit', async () => {
    const { rowsQuery } = configureListQuery(builder, [], 0);

    await repository.list({
      limit: 500,
      offset: -10,
    });

    expect(rowsQuery.limit).toHaveBeenCalledWith(100);

    expect(rowsQuery.offset).toHaveBeenCalledWith(0);
  });

  it('finds a DLQ entry by id', async () => {
    const row = createRow();

    builder.first = vi.fn().mockResolvedValue(row);

    const result = await repository.findById(row.id);

    expect(result).toMatchObject({
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      reason: row.reason,
      retryCount: row.retry_count,
      status: 'pending',
    });

    expect(builder.where).toHaveBeenCalledWith('id', row.id);
  });

  it('returns null when an id does not exist', async () => {
    builder.first = vi.fn().mockResolvedValue(undefined);

    const result = await repository.findById('missing-id');

    expect(result).toBeNull();
  });

  it('marks a pending entry for retry', async () => {
    const row = createRow({
      status: 'processing',
      next_retry_at: new Date(),
    });

    builder.returning = vi.fn().mockResolvedValue([row]);

    const result = await repository.markForRetry('dlq-id-1');

    expect(builder.where).toHaveBeenCalledWith('id', 'dlq-id-1');

    expect(builder.where).toHaveBeenCalledWith('status', 'pending');

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        resolved_at: null,
      }),
    );

    expect(result).toMatchObject({
      eventId: row.event_id,
      status: 'processing',
    });
  });

  it('returns null when retry target is not pending', async () => {
    builder.returning = vi.fn().mockResolvedValue([]);

    const result = await repository.markForRetry('already-resolved');

    expect(result).toBeNull();
  });

  it('discards a DLQ entry', async () => {
    const row = createRow({
      status: 'resolved',
      resolved_at: new Date(),
    });

    builder.returning = vi.fn().mockResolvedValue([row]);

    const result = await repository.discard('dlq-id-1');

    expect(builder.where).toHaveBeenCalledWith('id', 'dlq-id-1');

    expect(builder.whereNot).toHaveBeenCalledWith('status', 'resolved');

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
      }),
    );

    expect(result).toMatchObject({
      eventId: row.event_id,
      status: 'resolved',
    });
  });

  it('returns null when discarding a resolved entry', async () => {
    builder.returning = vi.fn().mockResolvedValue([]);

    const result = await repository.discard('resolved-id');

    expect(result).toBeNull();
  });

  it('accepts explicit list options', async () => {
    const options: DlqListOptions = {
      classification: 'configuration',
      status: 'pending',
      limit: 25,
      offset: 5,
    };

    const { rowsQuery } = configureListQuery(builder, [], 1);

    await repository.list(options);

    expect(builder.where).toHaveBeenCalledWith(
      'reason',
      'like',
      '[configuration]%',
    );

    expect(builder.where).toHaveBeenCalledWith('status', 'pending');

    expect(rowsQuery.limit).toHaveBeenCalledWith(25);

    expect(rowsQuery.offset).toHaveBeenCalledWith(5);
  });
});
