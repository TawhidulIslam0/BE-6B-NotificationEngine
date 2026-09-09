# ADR-003: RabbitMQ for Supporting Queue Workloads

## Status
Accepted

## Decision
Use RabbitMQ for supporting asynchronous work where queue semantics are
preferable to event-stream semantics.

## Examples
- Background jobs
- Digest generation
- Supporting retry workloads
- Auxiliary asynchronous processing

Kafka remains the primary event backbone.
