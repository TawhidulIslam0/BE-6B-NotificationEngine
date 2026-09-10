import type { EventEnvelope } from '../types/events.js';
import { EventDeduplicator } from '../deduplication/event-deduplicator.js';
import { EventEnricher } from '../enrichment/event-enricher.js';
import { EventRouter } from '../routing/event-router.js';

export class IngestionPipeline {
  constructor(
    private readonly deduplicator = new EventDeduplicator(),
    private readonly enricher = new EventEnricher(),
    private readonly router = new EventRouter(),
  ) {}
  async process(event: EventEnvelope) {
    const duplicate = await this.deduplicator.isDuplicate(event);
    if (duplicate) return { duplicate: true as const, event };
    const enriched = await this.enricher.enrich(event);
    const routing = this.router.route(
      event.event_type,
      event.priority,
      enriched.preferences,
    );
    return { duplicate: false as const, ...enriched, routing };
  }
}
