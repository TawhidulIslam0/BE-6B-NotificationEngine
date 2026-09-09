# ADR-001: Kafka as the Primary Event Backbone

## Status
Accepted

## Decision
Use Apache Kafka for the primary notification event stream.

## Rationale
The assignment requires high-volume event processing with consumer groups,
manual offsets and at-least-once semantics. Kafka provides durable event
streaming, partition-based parallelism and replay capabilities.

## Alternatives
RabbitMQ remains available for supporting queue workloads but is not the
primary notification event backbone. Direct synchronous HTTP processing was
rejected because it couples producers to downstream delivery.
