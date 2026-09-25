# BE-6B Notification Engine

> Event-driven, multi-channel notification backend for high-volume notification processing, compliance-aware routing, delivery tracking, retries, and operational analytics.

## Overview

**BE-6B Notification Engine** is a TypeScript/Node.js backend designed around an event-driven processing pipeline.

The current implementation combines:

- Kafka for event ingestion and asynchronous processing
- PostgreSQL for durable application state and analytics
- Redis for low-latency caching, deduplication, frequency counters, rate limiting, and provider state
- RabbitMQ as provisioned supporting queue infrastructure
- Provider adapters for SMS, email, push, WhatsApp, and in-app delivery
- Preference and compliance enforcement
- Localized and personalized notification templates
- Intelligent channel/provider routing
- Circuit breakers and provider failover
- Priority-aware retry policies and dead-letter queue processing
- Structured logging, correlation IDs, health checks, and graceful shutdown
- OpenAPI 3.0 documentation and Swagger UI
- Prometheus-compatible metrics and analytics APIs
- Dockerized development/test infrastructure
- GitHub Actions CI
- k6 load-test scenarios

The repository currently contains **34 event types** in `backend/docs/event-taxonomy.yaml`, covering account, security, transaction, payment, commerce, subscription, marketing, and system events.

## Key capabilities

| Capability          | Implementation                                                       |
| ------------------- | -------------------------------------------------------------------- |
| Event ingestion     | Express API → Kafka producer                                         |
| Event validation    | TypeScript models + Zod runtime validation                           |
| Event processing    | Kafka consumer + processing pipeline                                 |
| Deduplication       | Redis-backed event deduplication                                     |
| User preferences    | Preference service, cache, defaults, digest support                  |
| Compliance          | Consent, DND classification/registry, quiet hours, frequency caps    |
| Templates           | Handlebars-based rendering, personalization, localization            |
| Locales             | English, Hindi, Marathi, Tamil, Telugu                               |
| Channel routing     | Preference, delivery, regulatory, and cost-aware scoring             |
| Channels            | SMS, email, push, WhatsApp, in-app                                   |
| Provider resilience | Rate limiting, health checks, circuit breakers, failover             |
| Delivery tracking   | Delivery acknowledgement/state tracking                              |
| Retry               | Priority-aware exponential backoff with jitter and retry budgets     |
| DLQ                 | Persistent DLQ records, classification, retry/discard dashboard APIs |
| Analytics           | PostgreSQL analytics + Redis real-time counters                      |
| Metrics             | Prometheus-compatible `/metrics` endpoint                            |
| Observability       | Structured Pino logging + correlation IDs                            |
| API protection      | Express rate limiting + strict Zod request validation                |
| Health              | `/live`, `/ready`, `/health`, `/health/providers`                    |
| Documentation       | OpenAPI 3.0 + Swagger UI at `/api-docs`                              |
| Testing             | Vitest unit/integration/E2E coverage                                 |
| Load testing        | k6 normal, peak, market-crash, and 450k-request scenarios            |
| Infrastructure      | Docker Compose + Docker test stack                                   |
| CI                  | GitHub Actions lint/test/coverage/security/build                     |

## Architecture at a glance

```text
Client / Event Producer
        |
        v
POST /api/v1/events
        |
        v
Event Validation
        |
        v
Kafka
        |
        v
Notification Consumer
        |
        +--> Enrichment
        +--> Deduplication (Redis)
        +--> Preferences
        +--> Consent / DND
        +--> Quiet Hours
        +--> Frequency Caps
        |
        v
Template Engine
        |
        v
Channel Routing
        |
        v
Provider Selection
        |
        +--> SMS
        +--> Email
        +--> Push
        +--> WhatsApp
        +--> In-App / Socket.IO
        |
        v
Delivery Tracking
        |
        +--> Success
        |
        +--> Retry Scheduler
                |
                +--> Retry
                |
                +--> Dead Letter Queue
```

For the full system, container, component, data, reliability, and sequence diagrams, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Technology stack

- **Runtime:** Node.js 22
- **Language:** TypeScript
- **HTTP:** Express 5
- **Database:** PostgreSQL 15
- **Cache/state:** Redis 7
- **Event streaming:** Confluent Kafka 7.8
- **Supporting queue infrastructure:** RabbitMQ 3.12
- **Database access/migrations:** Knex
- **Validation:** Zod
- **Templates:** Handlebars
- **In-app transport:** Socket.IO
- **Email:** Nodemailer
- **Logging:** Pino
- **API documentation:** OpenAPI 3.0.3 + Swagger UI
- **Testing:** Vitest + Supertest
- **Load testing:** k6
- **Containers:** Docker / Docker Compose
- **Quality:** ESLint + Prettier
- **CI:** GitHub Actions

## Repository structure

The repository is organized as a shared project root with the backend implementation, an optional frontend workspace, and shared infrastructure.

```text
BE-6B-NotificationEngine/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── docs/
│   │   ├── architecture.md
│   │   ├── openapi.yaml
│   │   ├── event-taxonomy.yaml
│   │   └── 001/002/003 architecture decision records
│   ├── migrations/
│   ├── scripts/
│   │   └── k6/
│   ├── src/
│   │   ├── analytics/
│   │   ├── compliance/
│   │   ├── config/
│   │   ├── delivery/
│   │   ├── errors/
│   │   ├── events/
│   │   ├── infrastructure/
│   │   ├── logging/
│   │   ├── middleware/
│   │   ├── preferences/
│   │   └── template/
│   ├── tests/
│   ├── Dockerfile
│   ├── knexfile.cjs
│   ├── package.json
│   └── tsconfig.json
├── frontend/
├── docker-compose.yml
├── docker-compose.test.yml
├── .env.example
└── .github/workflows/ci.yml
```

The current source tree is the authoritative implementation. Some assignment-planned directories such as `src/notifications/`, `src/api/`, and `src/database/` are not separate directories in the current codebase; their responsibilities are implemented in the existing `events`, `delivery`, `preferences`, `infrastructure`, and application modules.

## Getting started

### Prerequisites

Install:

- Node.js 22+
- npm
- Docker Desktop
- Git

For load testing:

- k6

### 1. Configure environment

From the repository root:

```powershell
Copy-Item .env.example .env
```

Update local values as needed.

Do not commit `.env`. The repository already includes `.env.example` as the configuration template and ignores the local `.env`.

### 2. Start infrastructure

From the repository root:

```powershell
docker compose config
docker compose up -d
docker compose ps
```

The development stack provisions:

| Service                 | Host port |
| ----------------------- | --------: |
| Notification Engine API |    `3000` |
| PostgreSQL              |   `15432` |
| Redis                   |    `6379` |
| Kafka                   |    `9092` |
| RabbitMQ                |    `5672` |
| RabbitMQ Management     |   `15672` |

### 3. Install backend dependencies

```powershell
cd backend
npm ci
```

### 4. Run migrations

```powershell
npm run db:migrate
```

### 5. Seed users

```powershell
npm run db:seed
```

The seed script creates a varied set of users/preferences for development and testing.

### 6. Start the backend

Development mode:

```powershell
npm run dev
```

Production build:

```powershell
npm run build
npm start
```

## Quality checks

The standard local verification sequence is:

```powershell
npm run format
npm run typecheck
npm run lint
npm test
```

Additional checks:

```powershell
npm run format:check
npm run lint:fix
npm test -- --coverage
```

## Docker test environment

The repository includes an isolated test stack in `docker-compose.test.yml`.

From the repository root:

```powershell
docker compose -f .\docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test
```

The test stack provides isolated PostgreSQL, Redis, Kafka, and RabbitMQ containers and runs migrations before the Vitest suite.

## API documentation

The backend exposes Swagger UI at:

```text
http://localhost:3000/api-docs
```

The canonical OpenAPI specification is:

```text
backend/docs/openapi.yaml
```

Important API areas include:

- `POST /api/v1/events` — event ingestion
- `GET /users/:id/preferences` — retrieve user preferences
- `PUT /users/:id/preferences` — update user preferences
- `GET /dlq` — inspect dead-letter entries
- `POST /dlq/:id/retry` — retry a DLQ entry
- `POST /dlq/:id/discard` — resolve/discard a DLQ entry
- `GET /analytics/delivery-rates`
- `GET /analytics/channel-performance`
- `GET /analytics/opt-out-trends`
- `GET /analytics/costs`
- `GET /live` — liveness
- `GET /ready` — readiness
- `GET /health` — service health
- `GET /health/providers` — provider health
- `GET /metrics` — Prometheus-compatible metrics

See Swagger UI for request/response schemas and examples.

## Event model

Every event uses a common envelope containing fields such as:

- `event_id`
- `event_type`
- `event_version`
- `occurred_at`
- `user_id`
- `correlation_id`
- `source`
- `priority`
- event-specific `payload`

The taxonomy currently defines 34 event types.

Examples include:

```text
user.registered
user.welcome
user.password_reset_requested
transaction.created
transaction.completed
transaction.failed
payment.received
payment.failed
subscription.renewal_due
security.suspicious_activity
system.maintenance_scheduled
```

The complete taxonomy is maintained in:

```text
backend/docs/event-taxonomy.yaml
```

## Notification preferences and compliance

Preference resolution supports:

- enabled/disabled channels
- immediate/digest/disabled modes
- locale
- timezone
- quiet hours
- category/event preferences
- cached preferences
- digest scheduling

Compliance processing includes:

- consent checks
- DND classification and registry
- mandatory/critical notification bypass rules
- quiet-hours enforcement
- frequency caps
- compliance audit records

Preference updates are validated with a strict Zod schema before being applied.

## Templates

The template subsystem supports:

- template catalog and registry
- Handlebars rendering
- personalization pipeline
- reusable helpers
- template validation
- SMS formatting
- locale-specific definitions

Implemented locales:

```text
en
hi
mr
ta
te
```

Template source is under:

```text
backend/src/template/
```

## Routing and delivery

The routing engine considers:

1. regulatory requirements
2. channel eligibility
3. user preferences
4. delivery characteristics
5. cost/budget information

The delivery layer supports:

- SMS
- email
- push
- WhatsApp
- in-app

Provider wrappers add:

- provider-specific rate limiting
- circuit breakers
- health checks
- failover
- provider status handling

The default application bootstrap configures providers in test mode, while provider implementations also contain integration paths for external services such as SMTP, FCM HTTP v1, WhatsApp Cloud API, and configurable SMS APIs.

## Reliability and retry processing

Retry behavior is priority-aware.

Current default retry policies include:

| Priority | Max retries | Base delay | Maximum delay |
| -------- | ----------: | ---------: | ------------: |
| Critical |          10 |     500 ms |          60 s |
| High     |           5 |        1 s |         5 min |
| Normal   |           3 |        5 s |        30 min |
| Low      |           2 |       30 s |           2 h |

Retry delays use exponential backoff with bounded jitter.

Failures are classified and can be retried or persisted to the DLQ depending on failure type and retry state.

## Data layer

PostgreSQL contains durable records for:

- users
- partitioned notifications
- notification state history
- user preferences
- templates
- delivery providers
- consent records
- dead-letter entries

The `notifications` table is range-partitioned by `created_at`.

Analytics also adds a BRIN index on notification state-log timestamps.

Redis is used for low-latency state such as:

- event deduplication
- preference caching
- frequency counters
- rate limits
- provider/circuit-breaker state
- real-time analytics counters

## Observability

Structured JSON logging is provided by Pino.

Correlation IDs are carried through event processing and are attached to child loggers.

Health endpoints:

```text
/live
/ready
/health
/health/providers
```

Metrics:

```text
/metrics
```

The application also includes Prometheus alert definitions under:

```text
backend/src/config/prometheus-alerts.yml
```

Graceful shutdown handles `SIGINT` and `SIGTERM`, drains the application, disconnects Kafka/Redis/database resources, closes Socket.IO, and exits cleanly.

## Performance testing

The repository includes four k6 scenarios:

```text
backend/scripts/k6/normal-load.js
backend/scripts/k6/peak-load.js
backend/scripts/k6/market-crash.js
backend/scripts/k6/part-b-450k.js
```

They cover:

- normal load
- peak load
- market-crash/high-throughput load
- a 450,000-request sustained scenario

The event ingestion path was also optimized with PostgreSQL connection pooling and configurable Kafka consumer concurrency.

## Security

Security controls implemented in the current codebase include:

- environment-based secrets
- `.env` exclusion from Git
- strict Zod payload validation
- strict preference payload validation
- parameterized database access through Knex
- API rate limiting
- Helmet/CORS configuration
- provider credential placeholders rather than committed production credentials
- `npm audit --audit-level=high` in CI
- Snyk scanning during project validation
- secret-pattern review before submission

## CI/CD

GitHub Actions runs the backend quality pipeline on pushes and pull requests to `main` and `master`.

The current workflow performs:

1. checkout
2. Node.js 22 setup
3. dependency installation
4. high-severity npm audit
5. lint
6. test with coverage
7. coverage artifact upload
8. production build

Workflow:

```text
.github/workflows/ci.yml
```

## Docker

The production backend uses a multi-stage Dockerfile:

1. builder stage
2. production dependency stage
3. non-root production stage

The runtime image contains production dependencies and compiled application output rather than the development toolchain.

Docker Compose adds health checks, service dependencies, persistent volumes, and resource limits for the local production-like stack.

## Documentation

| Document                                                               | Purpose                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                   | Current system architecture and sequence diagrams |
| [`CHANGELOG.md`](CHANGELOG.md)                                         | Day-by-day project progress                       |
| [`backend/docs/architecture.md`](backend/docs/architecture.md)         | Detailed existing architecture reference          |
| [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)               | OpenAPI 3.0 contract                              |
| [`backend/docs/event-taxonomy.yaml`](backend/docs/event-taxonomy.yaml) | Event taxonomy                                    |
| `backend/docs/001-event-backbone.md`                                   | Kafka architecture decision                       |
| `backend/docs/002-postgresql-redis.md`                                 | PostgreSQL/Redis architecture decision            |
| `backend/docs/003-rabbitmq-supporting-queues.md`                       | RabbitMQ architecture decision                    |
| `backend/postman/notification-engine.postman_collection.json`          | Postman API collection                            |

## Project history

The implementation was built incrementally across the 15-day project schedule. The Git history contains the feature commits from the initial architecture and database foundation through Kafka ingestion, templates, preferences, compliance, delivery, retries/DLQ, analytics, load testing, observability, API documentation/testing, and Docker/security hardening.

See [`CHANGELOG.md`](CHANGELOG.md) for the consolidated history.
