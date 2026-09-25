# ADR-002: PostgreSQL as Primary Database and Redis for Fast-Access State

## Status

Accepted

## Decision

Use PostgreSQL as the primary persistent database and Redis for
high-performance caching and transient state.

PostgreSQL is the system of record for users, notifications,
notification state history, dead-letter records, user preferences,
templates, delivery providers, and consent records.

Redis is used for low-latency data such as caching, rate limiting,
frequency-cap state, temporary processing state, and analytics-related
counters where appropriate.

## Rationale

The notification engine requires durable relational storage for
notification records, user data, preferences, templates, consent, and
delivery history. PostgreSQL provides transactional consistency,
relational constraints, indexing, and reliable persistence for these
workloads.

Redis complements PostgreSQL by providing low-latency access for
frequently accessed or short-lived state. This reduces unnecessary
database load for operations such as frequency-cap checks, rate
limiting, caching, and high-frequency counters.

Redis is not treated as the system of record for durable notification
data.

## Alternatives

PostgreSQL only was rejected because high-frequency cache, rate-limit,
and transient-state operations would place unnecessary load on the
primary database.

Redis only was rejected because the notification engine requires durable
relational storage and transactional persistence for its core data.

MongoDB was not selected because the core domain contains related
entities, transactional state changes, and relational constraints that
fit the PostgreSQL data model.

## Consequences

PostgreSQL provides durable persistence and remains the authoritative
source for core notification-engine data.

Redis provides low-latency access for cache and transient-state
workloads.

The system must operate and monitor two data stores, and Redis
expiration and cache behavior must be managed appropriately.

PostgreSQL and Redis are provided as Docker Compose services for local
development and integration testing.