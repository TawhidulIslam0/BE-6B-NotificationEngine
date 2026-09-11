import { describe, expect, it } from 'vitest';
import { createTemplateRegistry } from '../catalog/template-catalog-loader.js';
import { PersonalisationPipeline } from './personalisation-pipeline.js';
import type { EventEnvelope } from '../../events/types/events.js';

const event = {
  event_id: 'evt-template-001',
  event_type: 'transaction.completed',
  occurred_at: '2026-09-11T20:00:00.000Z',
  priority: 'high',
  payload: {
    transaction_id: 'txn-001',
    amount: 1250,
    currency: 'USD',
  },
} as unknown as EventEnvelope;

describe('PersonalisationPipeline', () => {
  it('resolves user context and renders a template', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const result = await pipeline.process(
      event,
      {
        id: 'user-001',
        firstName: 'Tawhidul',
        lastName: 'Islam',
        email: 'test@example.com',
        locale: 'en',
      },
      {
        eventType: 'transaction.completed',
        channel: 'email',
        locale: 'en',
        version: 1,
        variant: 'A',
      },
    );

    expect(result.context.user.fullName).toBe('Tawhidul Islam');

    expect(result.rendered.templateId).toBe(
      'transaction.completed.email.en.v1.A',
    );

    expect(result.rendered.body).toContain('Tawhidul');

    expect(result.rendered.body).toContain('txn-001');
  });

  it('supports Hindi localisation', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const result = await pipeline.process(
      event,
      {
        id: 'user-002',
        firstName: 'Rahul',
        locale: 'hi',
      },
      {
        eventType: 'transaction.completed',
        channel: 'email',
        locale: 'hi',
        version: 1,
        variant: 'A',
      },
    );

    expect(result.rendered.locale).toBe('hi');
  });

  it('supports A/B variants', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const variantA = await pipeline.process(
      event,
      {
        id: 'user-003',
        firstName: 'Alex',
      },
      {
        eventType: 'transaction.completed',
        channel: 'email',
        locale: 'en',
        version: 1,
        variant: 'A',
      },
    );

    const variantB = await pipeline.process(
      event,
      {
        id: 'user-003',
        firstName: 'Alex',
      },
      {
        eventType: 'transaction.completed',
        channel: 'email',
        locale: 'en',
        version: 1,
        variant: 'B',
      },
    );

    expect(variantA.rendered.variant).toBe('A');

    expect(variantB.rendered.variant).toBe('B');

    expect(variantA.rendered.body).not.toBe(variantB.rendered.body);
  });

  it('falls back to English for unsupported user locale', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const result = await pipeline.process(
      event,
      {
        id: 'user-004',
        firstName: 'Alex',
        locale: 'fr',
      },
      {
        eventType: 'transaction.completed',
        channel: 'email',
        locale: 'en',
        version: 1,
        variant: 'A',
      },
    );

    expect(result.rendered.locale).toBe('en');
  });

  it('rejects missing required fields', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const incompleteEvent = {
      ...event,
      payload: {},
    } as EventEnvelope;

    await expect(
      pipeline.process(
        incompleteEvent,
        {
          id: 'user-005',
          firstName: 'Alex',
        },
        {
          eventType: 'transaction.completed',
          channel: 'email',
          locale: 'en',
          version: 1,
          variant: 'A',
        },
      ),
    ).rejects.toThrow();
  });

  it('renders SMS and respects the 160 character limit', async () => {
    const registry = createTemplateRegistry();

    const pipeline = new PersonalisationPipeline(registry);

    const result = await pipeline.process(
      event,
      {
        id: 'user-006',
        firstName: 'Alex',
      },
      {
        eventType: 'transaction.completed',
        channel: 'sms',
        locale: 'en',
        version: 1,
        variant: 'B',
      },
    );

    expect(result.rendered.body.length).toBeLessThanOrEqual(160);
  });
});
