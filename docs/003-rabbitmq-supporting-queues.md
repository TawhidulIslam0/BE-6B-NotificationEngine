# ADR-003: RabbitMQ for Supporting Queue Workloads

## Status

Accepted

## Decision

Use RabbitMQ for supporting asynchronous work where queue semantics are
preferable to event-stream semantics.

## Rationale

RabbitMQ provides queue-based message delivery, acknowledgements, and
worker-oriented processing that complement Kafka's event-streaming model.

It is therefore used for supporting asynchronous workloads rather than
serving as the primary notification event backbone.

## Examples

- Background jobs
- Digest generation
- Supporting retry workloads
- Auxiliary asynchronous processing

## Alternatives

Kafka is not used for these workloads when traditional queue semantics
are more appropriate.

Direct synchronous processing was rejected because it couples the
requesting operation to downstream asynchronous work.

## Consequences

RabbitMQ provides a dedicated queue-based mechanism for supporting
asynchronous workloads.

The system must manage queues, exchanges, acknowledgements, and consumer
lifecycle.

Kafka remains the primary event backbone for notification events.