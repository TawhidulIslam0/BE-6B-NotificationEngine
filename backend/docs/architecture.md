# Notification Engine Architecture

## 1. Overview

The Notification Engine is an event-driven, multi-channel notification platform
designed to process high-volume notification events and deliver notifications
through SMS, email, push, WhatsApp, and in-app channels.

Kafka is the primary event backbone. PostgreSQL is the durable system of record,
Redis provides low-latency caching and temporary state, and RabbitMQ supports
asynchronous work-queue workloads.

## 2. Architecture Goals

- High-volume event ingestion and asynchronous processing
- At-least-once event processing
- SMS, email, push, WhatsApp, and in-app delivery
- Runtime event validation
- User preference and regulatory-policy enforcement
- Consent and DND enforcement
- Timezone-aware quiet hours
- Frequency limiting and deduplication
- Localized and personalized templates
- Provider health, circuit breaking, and failover
- Exponential backoff, jitter, retry budgets, and DLQ processing
- Durable notification state and auditability
- Operational metrics and analytics
- Horizontal scalability

## 3. High-Level Event Pipeline

```text
Client Application
      |
      v
API Gateway
      |
      v
Event Ingestion
      |
      v
Schema Validation
      |
      v
Kafka
      |
      v
Notification Processor
      |
      +--> Enrichment
      +--> Deduplication
      +--> Preferences
      +--> Consent / DND
      +--> Quiet Hours
      +--> Frequency Limits
      |
      v
Template Engine
      |
      v
Channel Router
      |
      v
Provider Manager
      |
      +--> SMS
      +--> Email
      +--> Push
      +--> WhatsApp
      +--> In-App
      |
      v
Delivery Tracking
      |
      +--> Success
      |
      +--> Retry --> DLQ
```

## 4. C4 System Context

```mermaid
C4Context
title Notification Engine - System Context

Person(user, "End User", "Receives notifications")

System(notificationEngine, "Notification Engine",
  "Event-driven multi-channel notification platform")

System_Ext(clientApplications, "Client Applications",
  "Applications and services that generate notification events")

System_Ext(smsProviders, "SMS Providers",
  "External SMS delivery providers")

System_Ext(emailProviders, "Email Providers",
  "External email delivery providers")

System_Ext(pushProviders, "Push Providers",
  "External push notification providers")

System_Ext(whatsappApi, "WhatsApp Cloud API",
  "WhatsApp notification delivery platform")

Rel(clientApplications, notificationEngine, "Publishes notification events")
Rel(notificationEngine, user, "Delivers notifications")
Rel(notificationEngine, smsProviders, "Sends SMS")
Rel(notificationEngine, emailProviders, "Sends email")
Rel(notificationEngine, pushProviders, "Sends push notifications")
Rel(notificationEngine, whatsappApi, "Sends WhatsApp notifications")
```

## 5. C4 Container Diagram

```mermaid
C4Container
title Notification Engine - Container Diagram

Person(user, "End User", "Receives notifications")
System_Ext(client, "Client Applications", "Applications and services generating events")

System_Boundary(engine, "Notification Engine") {
  Container(api, "API Gateway", "Node.js / TypeScript / Express",
    "HTTP APIs, authentication, validation and rate limiting")
  Container(ingestion, "Event Ingestion Service", "Node.js / TypeScript",
    "Validates, normalizes and publishes events")
  Container(kafka, "Kafka", "Confluent Kafka",
    "Primary event streaming backbone")
  Container(processor, "Notification Processor", "Node.js / TypeScript",
    "Consumes events and applies notification business rules")
  Container(router, "Channel Router", "Node.js / TypeScript",
    "Selects eligible notification channels")
  Container(delivery, "Delivery Service", "Node.js / TypeScript",
    "Coordinates provider delivery, failover and callbacks")
  ContainerDb(postgres, "PostgreSQL", "PostgreSQL 15",
    "Durable users, notifications, preferences, templates, providers, consent and DLQ data")
  ContainerDb(redis, "Redis", "Redis 7",
    "Caching, deduplication, rate limits, frequency caps and real-time counters")
  ContainerQueue(rabbitmq, "RabbitMQ", "RabbitMQ 3.12",
    "Supporting asynchronous work queues")
  Container(dashboard, "Operations Dashboard", "React / Vite / TypeScript",
    "Analytics, operational monitoring and DLQ management")
}

System_Ext(sms, "SMS Providers", "MSG91 / Twilio")
System_Ext(email, "Email Providers", "SMTP / Email APIs")
System_Ext(push, "Push Providers", "FCM / APNs")
System_Ext(whatsapp, "WhatsApp Cloud API", "WhatsApp delivery")

Rel(client, api, "Sends notification requests")
Rel(api, ingestion, "Forwards notification events")
Rel(ingestion, kafka, "Publishes events")
Rel(kafka, processor, "Delivers events")
Rel(processor, postgres, "Reads/writes durable state")
Rel(processor, redis, "Reads/writes fast state")
Rel(processor, rabbitmq, "Queues supporting work")
Rel(processor, router, "Requests channel selection")
Rel(router, delivery, "Routes notifications")
Rel(delivery, sms, "Sends SMS")
Rel(delivery, email, "Sends email")
Rel(delivery, push, "Sends push")
Rel(delivery, whatsapp, "Sends WhatsApp")
Rel(delivery, postgres, "Records delivery state")
Rel(delivery, redis, "Uses provider/rate-limit state")
Rel(dashboard, api, "Calls management APIs")
Rel(dashboard, postgres, "Reads operational data")
Rel(dashboard, redis, "Reads real-time metrics")
Rel(delivery, user, "Delivers notifications")
```

## 6. C4 Component Diagram

```mermaid
C4Component
title Notification Processor - Component Diagram

Container_Boundary(processor, "Notification Processor") {
  Component(eventConsumer, "Event Consumer", "Kafka Consumer",
    "Consumes events with consumer groups and manual offsets")
  Component(eventValidator, "Event Validator", "TypeScript + Zod",
    "Validates event envelopes and event-specific payloads")
  Component(enrichment, "Event Enrichment", "TypeScript",
    "Adds user, preference, template and contextual data")
  Component(deduplication, "Deduplication Service", "Redis",
    "Prevents duplicate event processing")
  Component(preferences, "Preference Service", "TypeScript",
    "Resolves effective notification preferences")
  Component(consent, "Consent & DND Service", "TypeScript",
    "Checks consent, DND and notification classification")
  Component(quietHours, "Quiet Hours Service", "TypeScript",
    "Evaluates timezone-aware quiet-hour policy")
  Component(frequency, "Frequency Limit Service", "Redis",
    "Enforces notification frequency caps")
  Component(templateEngine, "Template Engine", "Handlebars",
    "Selects and renders localized templates")
  Component(channelRouter, "Channel Router", "TypeScript",
    "Selects eligible channels")
  Component(providerManager, "Provider Manager", "TypeScript",
    "Selects providers, health state and failover")
  Component(deliveryTracker, "Delivery Tracker", "TypeScript",
    "Persists notification and delivery state")
}

Container_Ext(kafka, "Kafka", "Event streaming platform")
ContainerDb_Ext(redis, "Redis", "Cache and temporary state")
ContainerDb_Ext(postgres, "PostgreSQL", "Durable relational storage")
Container_Ext(providers, "Notification Providers",
  "SMS, Email, Push, WhatsApp and In-App")

Rel(kafka, eventConsumer, "Delivers events")
Rel(eventConsumer, eventValidator, "Validates event")
Rel(eventValidator, enrichment, "Passes valid event")
Rel(enrichment, deduplication, "Checks event identity")
Rel(deduplication, preferences, "Loads preferences")
Rel(preferences, consent, "Checks consent/DND")
Rel(consent, quietHours, "Checks quiet hours")
Rel(quietHours, frequency, "Checks frequency limits")
Rel(frequency, templateEngine, "Requests template")
Rel(templateEngine, channelRouter, "Provides rendered message")
Rel(channelRouter, providerManager, "Selects channel")
Rel(providerManager, providers, "Delivers notification")
Rel(providerManager, deliveryTracker, "Reports result")
Rel(deduplication, redis, "Stores deduplication keys")
Rel(preferences, redis, "Reads cached preferences")
Rel(preferences, postgres, "Reads preference data")
Rel(frequency, redis, "Maintains counters")
Rel(templateEngine, postgres, "Loads templates")
Rel(deliveryTracker, postgres, "Stores delivery state")
```

## 7. Event Processing Lifecycle

1. A client submits a notification event.
2. The API Gateway authenticates and rate-limits the request.
3. Event Ingestion validates the event envelope and payload.
4. A valid event is published to the appropriate Kafka topic.
5. A consumer receives the event using a consumer group.
6. The event is validated again at the processing boundary.
7. User and contextual information is enriched.
8. Redis is checked for duplicate processing.
9. Effective preferences are resolved.
10. Consent, DND, classification and regulatory rules are evaluated.
11. Quiet hours and frequency caps are evaluated.
12. A localized template is selected and rendered.
13. Eligible channels are scored/routed.
14. A healthy provider is selected.
15. The notification is delivered.
16. Delivery state is persisted.
17. Transient failures enter retry processing.
18. Exhausted or permanent failures enter the DLQ.

## 8. Kafka Topics

| Topic | Purpose |
|---|---|
| `notification-events` | Normal notification events |
| `notification-critical` | High-priority/critical notification events |
| `notification-dlq` | Exhausted or unrecoverable events |

Consumers use consumer groups and manual offset commits for at-least-once
processing.

## 9. Data Architecture

### PostgreSQL

Durable system of record for users, notifications, notification state logs,
DLQ records, preferences, templates, delivery providers and consent records.

### Redis

Low-latency state for preference caching, deduplication, frequency counters,
rate limits, provider health, circuit breakers and real-time counters.

### RabbitMQ

Supporting asynchronous work queues, including background jobs and digest
workloads where queue semantics are preferable to event-stream semantics.

## 10. Reliability

- At-least-once Kafka processing
- Manual offset management
- Idempotent event processing
- Redis deduplication
- Exponential backoff with jitter
- Retry budgets
- Priority-aware retries
- Dead-letter processing
- Provider health checks
- Circuit breakers
- Provider failover
- Durable notification state

## 11. Security

- Environment-based secrets
- `.env` excluded from source control
- Authentication and authorization middleware
- Runtime input validation
- Request sanitization
- API rate limiting
- Secure provider credentials
- TLS for external communication
- Structured audit logging
- Immutable consent audit records

## 12. Observability

The system will expose Prometheus-compatible metrics including event counts,
delivery rates, failures, retries, DLQ volume, provider latency, provider
failure rate, channel performance, Kafka consumer lag and API latency.

Structured logs will include timestamp, level, service, event ID,
correlation ID, notification ID, provider and error classification where
appropriate.

## 13. Scalability

Kafka partitions allow notification consumers to scale horizontally.
API instances can scale behind a load balancer. Redis reduces repeated
database reads, while PostgreSQL connection pooling controls database
connection pressure. Provider-specific rate limits protect external
dependencies.

## 14. Technology Decisions

| Technology | Purpose | Justification |
|---|---|---|
| Node.js | Backend runtime | Strong asynchronous I/O model for event-driven workloads |
| TypeScript | Backend language | Compile-time type safety and maintainability |
| Express | API framework | Lightweight HTTP framework for internal APIs |
| React + Vite | Operations dashboard | Fast component-based operational UI |
| PostgreSQL | Durable database | Relational integrity and durable transactional state |
| Redis | Cache/state | Low-latency caching, counters and deduplication |
| Kafka | Event backbone | Durable streaming, consumer groups and partition-based scaling |
| RabbitMQ | Supporting queues | Queue semantics for background work |
| Zod | Runtime validation | Type-safe runtime schema validation |
| Handlebars | Templates | Dynamic notification rendering |
| Docker Compose | Local infrastructure | Reproducible local PostgreSQL, Redis, Kafka and RabbitMQ environment |
| ESLint | Static analysis | TypeScript/JavaScript quality enforcement |
| Prettier | Formatting | Consistent source formatting |

## 15. API Contract Strategy

Internal APIs use OpenAPI 3.0.3. The contract covers:

- Event ingestion
- User preference retrieval/update
- Notification lookup
- DLQ listing/filtering/retry/discard
- Analytics
- Health/readiness/liveness

The canonical contract is stored at `docs/openapi.yaml`.

## 16. Architecture Decisions

Architecture decision records are stored under `docs/adr/`.

Current decisions:

- ADR-001: Kafka as the primary event backbone
- ADR-002: PostgreSQL and Redis storage strategy
- ADR-003: RabbitMQ for supporting queue workloads
