import type { EventEnvelope } from '../types/events.js';
import { EventDeduplicator } from '../deduplication/event-deduplicator.js';
import { EventEnricher } from '../enrichment/event-enricher.js';
import { EventRouter, type RoutingDecision } from '../routing/event-router.js';
import type { PreferenceService } from '../../preferences/service.js';
import { PreferenceRoutingAdapter } from '../../preferences/routing-adapter.js';

export interface PipelineResult {
  duplicate: boolean;
  event: EventEnvelope;
  routing?: RoutingDecision;
}

export class IngestionPipeline {
  private readonly preferenceRouter: PreferenceRoutingAdapter;

  constructor(
    private readonly deduplicator = new EventDeduplicator(),
    private readonly enricher = new EventEnricher(),
    private readonly router = new EventRouter(),
    private readonly preferenceService?: PreferenceService,
  ) {
    this.preferenceRouter = new PreferenceRoutingAdapter(router);
  }

  async process(event: EventEnvelope): Promise<PipelineResult> {
    const duplicate = await this.deduplicator.isDuplicate(event);

    if (duplicate) {
      return {
        duplicate: true,
        event,
      };
    }

    const enriched = await this.enricher.enrich(event);

    let routing: RoutingDecision;

    if (this.preferenceService) {
      const preferences = await this.preferenceService.get(event.user_id);

      routing = this.preferenceRouter.route(event, preferences);
    } else {
      routing = this.router.route(
        event.event_type,
        event.priority,
        enriched.preferences,
      );
    }

    return {
      duplicate: false,
      event,
      routing,
    };
  }
}
