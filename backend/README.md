# BE-6B-NotificationEngine

Event-driven, multi-channel notification engine built with Node.js,
TypeScript, React/Vite, PostgreSQL, Redis, Kafka and RabbitMQ.

## Day 1 Foundation

The project provides:

- Strict TypeScript configuration
- ESLint and Prettier
- React/Vite operations dashboard
- Docker Compose development infrastructure
- PostgreSQL 15
- Redis 7
- Confluent Kafka
- RabbitMQ 3.12
- C4 architecture documentation
- OpenAPI 3.0 internal API contracts
- 25+ event taxonomy definitions
- Architecture Decision Records

## Repository Structure

```text
BE-6B-NotificationEngine/
├── src/
├── tests/
├── docs/
│   ├── architecture.md
│   ├── openapi.yaml
│   ├── event-taxonomy.yaml
│   └── adr/
├── config/
├── scripts/
├── migrations/
├── package.json
├── tsconfig.json
└── README.md
```

The backend project is contained in this directory. The repository root also
contains the frontend and the shared Docker Compose configuration.

## Infrastructure

```powershell
docker compose config
docker compose up -d
docker compose ps
```

Expected services:

- PostgreSQL: `localhost:15432`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`
- RabbitMQ: `localhost:5672`
- RabbitMQ Management UI: `localhost:15672`

## Architecture

Kafka is the primary event backbone. PostgreSQL stores durable application
state. Redis handles low-latency state, caching, deduplication and counters.
RabbitMQ supports asynchronous work-queue workloads.

See `docs/architecture.md` for C4 diagrams, the event pipeline and technology
decisions.

## API Contract

The canonical OpenAPI 3.0 contract is:

`docs/openapi.yaml`

It covers event ingestion, preferences, notification state, DLQ operations,
analytics and health/readiness endpoints.

## Security

Never commit `.env`. Use `.env.example` as the configuration template.

## Architecture Decision Records

- `docs/adr/001-event-backbone.md`
- `docs/adr/002-postgresql-redis.md`
- `docs/adr/003-rabbitmq-supporting-queues.md`
