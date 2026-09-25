# ADR-001: Kafka as the Primary Event Backbone

## Status

Accepted

## Decision

Use Apache Kafka for the primary notification event stream.

## Rationale

The assignment requires high-volume event processing with consumer groups,
manual offsets, and at-least-once semantics. Kafka provides durable event
streaming, partition-based parallelism, and replay capabilities.

Kafka is therefore responsible for the primary event-streaming workload
within the notification engine.

## Alternatives

RabbitMQ remains available for supporting queue workloads but is not the
primary notification event backbone.

Direct synchronous HTTP processing was rejected because it couples
producers to downstream processing and delivery.

## Consequences

Kafka provides durable event storage, consumer-group based parallelism,
and replay capabilities for notification events.

The system must manage Kafka topics, partitions, consumer groups, and
offset handling.

RabbitMQ can be used independently for workloads where queue semantics
are preferable.