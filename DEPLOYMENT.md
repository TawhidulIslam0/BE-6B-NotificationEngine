# BE-6B Notification Engine — Production Deployment Guide

## 1. Purpose

This document provides the production deployment checklist for the **BE-6B Notification Engine**.

It is based on the implementation and infrastructure contained in the reviewed project archive. It covers application configuration, PostgreSQL, Redis, Kafka, RabbitMQ, delivery providers, Docker deployment, migrations, security, observability, health checks, rollback, and final verification.

> **Current-state note:** The repository contains production containerization and operational building blocks, but it does not establish that a specific cloud provider, Kubernetes cluster, managed database, managed Kafka service, or production provider account has already been deployed.

---

## 2. Production architecture

```text
External Producers
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
        +--> User Preferences
        +--> Consent / DND
        +--> Quiet Hours
        +--> Frequency Caps
        |
        v
Template / Personalization
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
        +--> In-App
        |
        v
Delivery Tracking
        |
        +--> Analytics
        |
        +--> Retry
                |
                +--> Retry succeeds
                |
                +--> Dead Letter Queue
```

Kafka is the active event backbone in the current application. RabbitMQ is provisioned as supporting queue infrastructure.

---

# 3. Production readiness checklist

## 3.1 Release source

- [ ] Confirm the intended release commit.
- [ ] Confirm the working tree is clean.
- [ ] Confirm all Day 15 documentation is committed.
- [ ] Confirm no debugging code remains.
- [ ] Confirm no temporary files remain.
- [ ] Confirm no unintended TODOs remain.
- [ ] Confirm no real credentials are committed.
- [ ] Confirm `.env` is ignored by Git.
- [ ] Confirm `.env.example` contains configuration names but no production secrets.
- [ ] Confirm the final repository contains `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, and `DEPLOYMENT.md`.

---

# 4. Required production infrastructure

Provision production equivalents of:

| Component           | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| Node.js application | Notification API and processing runtime                     |
| PostgreSQL 15       | Durable application state and analytics                     |
| Redis 7             | Cache, deduplication, counters, rate limits, provider state |
| Kafka               | Event backbone and asynchronous processing                  |
| RabbitMQ 3.12       | Supporting queue infrastructure when required               |
| SMS provider        | SMS delivery                                                |
| Email provider      | Email delivery                                              |
| Push provider       | Push delivery                                               |
| WhatsApp provider   | WhatsApp delivery                                           |
| In-app transport    | Socket.IO/in-app delivery                                   |

Where available, use managed/high-availability infrastructure for stateful production services.

---

# 5. Environment configuration

Production configuration must be supplied through the deployment environment or a secret manager.

## PostgreSQL

```env
NODE_ENV=production

POSTGRES_HOST=<production-postgres-host>
POSTGRES_PORT=5432
POSTGRES_DB=<production-database>
POSTGRES_USER=<production-user>
POSTGRES_PASSWORD=<production-secret>
```

Checklist:

- [ ] Dedicated production database.
- [ ] Dedicated production database user.
- [ ] Strong generated password.
- [ ] Password stored in a secret manager.
- [ ] Production database is not publicly exposed.
- [ ] Automated backups enabled.
- [ ] Backup retention configured.
- [ ] Point-in-time recovery enabled where supported.
- [ ] Connection limits reviewed.
- [ ] Storage monitoring configured.
- [ ] Required notification partitions exist.

## Redis

```env
REDIS_HOST=<production-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<production-secret>
```

Checklist:

- [ ] Production Redis instance/cluster provisioned.
- [ ] Authentication enabled where supported.
- [ ] Network access restricted.
- [ ] TLS enabled when required.
- [ ] Memory limits configured.
- [ ] Eviction policy reviewed.
- [ ] Memory monitoring enabled.
- [ ] Connection monitoring enabled.
- [ ] Deduplication verified.
- [ ] Preference cache verified.
- [ ] Frequency-cap counters verified.
- [ ] Rate-limit state verified.
- [ ] Provider/circuit-breaker state verified.

Redis is not the authoritative store for durable notification history.

## Kafka

```env
KAFKA_BROKERS=<broker-1>:9092,<broker-2>:9092,<broker-3>:9092
KAFKA_CONSUMER_CONCURRENCY=<production-value>
```

Checklist:

- [ ] Production Kafka cluster provisioned.
- [ ] Broker replication configured.
- [ ] Authentication/TLS configured where required.
- [ ] Topic partitions reviewed.
- [ ] Topic retention configured.
- [ ] Replication factor reviewed.
- [ ] Consumer group configured.
- [ ] Consumer concurrency configured.
- [ ] Consumer lag monitoring enabled.
- [ ] Producer connectivity verified.
- [ ] Consumer connectivity verified.
- [ ] Graceful consumer shutdown verified.

---

# 6. RabbitMQ

The repository provisions RabbitMQ as supporting queue infrastructure.

If the production deployment uses this path:

- [ ] Production RabbitMQ provisioned.
- [ ] Production credentials configured.
- [ ] Network access restricted.
- [ ] TLS configured where required.
- [ ] Durable queues configured.
- [ ] Monitoring configured.
- [ ] Health checks verified.

> The current application source uses Kafka as the active event backbone. RabbitMQ should only be enabled for production workloads that actually use the supporting queue integration.

---

# 7. Delivery provider configuration

The implementation contains adapters for SMS, Email, Push, WhatsApp, and In-App delivery.

Production credentials must be injected through secrets.

## SMS

- [ ] Production SMS provider configured.
- [ ] Provider credentials stored as secrets.
- [ ] Sender identity configured.
- [ ] DND/regulatory requirements verified.
- [ ] Provider rate limits reviewed.
- [ ] Delivery callbacks configured if applicable.
- [ ] Failure behavior tested.
- [ ] Provider failover tested.

## Email

- [ ] Production SMTP/email provider configured.
- [ ] Credentials stored as secrets.
- [ ] Sender identity configured.
- [ ] SPF/DKIM/DMARC configured as required.
- [ ] Provider rate limits reviewed.
- [ ] Successful delivery tested.
- [ ] Transient failure tested.
- [ ] Permanent failure tested.

## Push

- [ ] Production push provider configured.
- [ ] FCM credentials configured where applicable.
- [ ] Credentials stored as secrets.
- [ ] Device-token flow verified.
- [ ] Valid push tested.
- [ ] Invalid-token handling tested.

## WhatsApp

- [ ] Production WhatsApp provider configured.
- [ ] API credentials stored as secrets.
- [ ] Required production templates approved/configured.
- [ ] Recipient requirements verified.
- [ ] Successful delivery tested.
- [ ] Provider failure tested.
- [ ] Provider rate limits reviewed.

## In-app

- [ ] Production Socket.IO endpoint configured.
- [ ] Reverse proxy/load balancer supports WebSockets.
- [ ] Multi-instance Socket.IO strategy configured if required.
- [ ] Connection health verified.
- [ ] In-app notification delivery tested.

---

# 8. Secrets management

Never commit production secrets.

Secret categories include PostgreSQL, Redis, Kafka, RabbitMQ, SMS, Email, Push, WhatsApp, and application credentials.

Checklist:

- [ ] Use the platform's secret manager.
- [ ] Separate development/test/staging/production secrets.
- [ ] Rotate credentials if development credentials were reused.
- [ ] Apply least-privilege access.
- [ ] Audit secret access.
- [ ] Never print secrets in logs.
- [ ] Never expose secrets in API responses.
- [ ] Never bake secrets into Docker images.
- [ ] Verify secret-pattern scans are clean.

---

# 9. Database deployment

Create a production backup/snapshot before migrations.

```powershell
cd backend
npm run db:migrate
```

Checklist:

- [ ] Backup completed.
- [ ] Migration status reviewed.
- [ ] Migrations completed successfully.
- [ ] Notification partitions created.
- [ ] Required indexes exist.
- [ ] Constraints verified.
- [ ] Database permissions verified.
- [ ] Application can connect after migration.

Do **not** run the development seed script against production unless an explicitly approved production data-seeding process exists.

---

# 10. Production Docker image

The repository uses a multi-stage Dockerfile.

```powershell
docker build -t notification-engine:production .
```

The production image uses `builder`, `production-deps`, and `production` stages.

Checklist:

- [ ] Build succeeds.
- [ ] No `.env` is included.
- [ ] No development secrets are included.
- [ ] Only production dependencies are installed in the runtime stage.
- [ ] Compiled application output exists.
- [ ] Container runs as the non-root `node` user.
- [ ] Port `3000` is exposed.
- [ ] Container starts successfully.
- [ ] Image size is reviewed.
- [ ] Release image digest is recorded.

---

# 11. Container deployment

```powershell
docker compose up -d --build
docker compose ps
docker compose logs
```

Checklist:

- [ ] Application healthy.
- [ ] PostgreSQL healthy.
- [ ] Redis healthy.
- [ ] Kafka healthy.
- [ ] RabbitMQ healthy if enabled.
- [ ] Dependencies reachable.
- [ ] Resource limits configured.
- [ ] Persistent volumes configured for stateful services.
- [ ] Restart policies configured.
- [ ] Logs collected centrally.

---

# 12. Health and readiness verification

The application exposes:

```text
GET /live
GET /ready
GET /health
GET /health/providers
```

Verify:

```powershell
curl http://localhost:3000/live
curl http://localhost:3000/ready
curl http://localhost:3000/health
curl http://localhost:3000/health/providers
```

Checklist:

- [ ] `/live` succeeds.
- [ ] `/ready` succeeds.
- [ ] PostgreSQL is healthy.
- [ ] Redis is healthy.
- [ ] Kafka is healthy.
- [ ] Provider health is correct.
- [ ] Load balancer uses appropriate readiness/liveness checks.

---

# 13. API verification

Swagger UI:

```text
http://localhost:3000/api-docs
```

Verify:

- [ ] Swagger UI loads.
- [ ] OpenAPI specification loads.
- [ ] `POST /api/v1/events` accepts a valid event.
- [ ] Invalid events are rejected.
- [ ] Preference APIs work.
- [ ] DLQ APIs work.
- [ ] Analytics APIs work.
- [ ] `/metrics` works.
- [ ] Rate limiting is active.
- [ ] Error responses do not expose sensitive information.

---

# 14. Event-ingestion smoke test

Run a controlled event through `POST /api/v1/events` and verify:

```text
HTTP API
   ↓
Kafka
   ↓
Consumer
   ↓
Event processing
   ↓
Preferences / Compliance
   ↓
Template rendering
   ↓
Routing
   ↓
Provider
   ↓
Delivery acknowledgement
   ↓
PostgreSQL / Redis analytics
```

Checklist:

- [ ] API returns `202 Accepted`.
- [ ] Event is published to Kafka.
- [ ] Consumer receives the event.
- [ ] Deduplication works.
- [ ] Preferences are applied.
- [ ] Consent/DND rules are applied.
- [ ] Quiet hours are applied.
- [ ] Frequency cap is applied.
- [ ] Template renders.
- [ ] Correct channel is selected.
- [ ] Provider executes.
- [ ] Delivery state is persisted.
- [ ] Analytics update.
- [ ] Correlation ID appears in logs.

---

# 15. Compliance verification

Before real notification traffic:

- [ ] Consent records verified.
- [ ] DND registry verified.
- [ ] Mandatory/critical notification behavior verified.
- [ ] Quiet hours verified.
- [ ] Frequency caps verified.
- [ ] Timezone handling verified.
- [ ] Compliance audit records verified.
- [ ] Preference changes verified.
- [ ] Non-mandatory DND notifications blocked.
- [ ] Mandatory notification behavior verified.

For production financial notifications, regulatory requirements should be reviewed and approved by the responsible compliance/legal stakeholders before launch.

---

# 16. Retry and DLQ verification

Verify both recovery paths:

```text
Provider failure → classification → retry policy → retry budget → retry
Provider failure → retry budget exhausted → DLQ
```

Checklist:

- [ ] Transient errors are retryable.
- [ ] Permanent errors do not retry indefinitely.
- [ ] Retry count persists.
- [ ] Exponential backoff works.
- [ ] Jitter works.
- [ ] Priority changes retry policy.
- [ ] Retry budget is enforced.
- [ ] Exhausted messages enter DLQ.
- [ ] DLQ records are queryable.
- [ ] DLQ retry endpoint works.
- [ ] DLQ discard/resolution endpoint works.
- [ ] DLQ alerts are configured.

---

# 17. Provider resilience verification

```text
Primary provider failure
        ↓
Circuit breaker / failover
        ↓
Secondary provider
        ↓
Delivery
```

Checklist:

- [ ] Provider health check works.
- [ ] Provider rate limiting works.
- [ ] Circuit breaker opens after configured failures.
- [ ] Circuit breaker recovery works.
- [ ] Secondary provider is selected during failover.
- [ ] Delivery state records the provider used.
- [ ] Repeated provider failure reaches retry/DLQ handling.

---

# 18. Rate limiting

The application has a global public API limiter and a dedicated event-ingestion limiter.

Checklist:

- [ ] Production limits reviewed.
- [ ] Health endpoints remain available.
- [ ] Metrics remain available.
- [ ] `RateLimit-*` headers behave as expected.
- [ ] HTTP 429 responses are monitored.
- [ ] API gateway limits do not unintentionally conflict with application limits.

---

# 19. Observability

## Logging

The application uses structured Pino logging and correlation IDs.

- [ ] JSON logs collected centrally.
- [ ] Log retention configured.
- [ ] Correlation ID searchable.
- [ ] Error logs monitored.
- [ ] Provider failures monitored.
- [ ] Retry activity monitored.
- [ ] DLQ activity monitored.
- [ ] Sensitive payload data is not unnecessarily logged.
- [ ] Secrets are never logged.

## Metrics

The application exposes:

```text
GET /metrics
```

Monitor HTTP traffic, Kafka lag, notification throughput, delivery success/failure, retry rate, DLQ depth, provider errors/circuit state, PostgreSQL pool usage, and Redis health.

---

# 20. Alerting

Configure alerts for:

- [ ] Application unavailable.
- [ ] Readiness failures.
- [ ] HTTP 5xx spikes.
- [ ] HTTP latency degradation.
- [ ] Kafka consumer lag.
- [ ] Kafka connectivity failures.
- [ ] PostgreSQL connection exhaustion.
- [ ] Redis unavailable.
- [ ] Provider failure spikes.
- [ ] Circuit breakers remaining open.
- [ ] Retry volume spikes.
- [ ] DLQ depth increasing.
- [ ] Delivery success-rate degradation.

Prometheus alert definitions are maintained in:

```text
backend/src/config/prometheus-alerts.yml
```

---

# 21. Security verification

```powershell
npm audit --audit-level=high
```

Also run the project's Snyk validation.

Checklist:

- [ ] No high/critical npm vulnerabilities.
- [ ] Snyk validation passes according to release policy.
- [ ] No production credentials in Git.
- [ ] No secrets in Docker images.
- [ ] `.env` ignored.
- [ ] CORS restricted to required origins.
- [ ] Helmet enabled.
- [ ] Rate limiting enabled.
- [ ] Input validation enabled.
- [ ] Database access remains parameterized.
- [ ] Provider credentials use least privilege.
- [ ] Database user uses least privilege.
- [ ] Redis access restricted.
- [ ] Kafka access restricted.
- [ ] RabbitMQ access restricted if enabled.

---

# 22. TLS and network security

Recommended production boundary:

```text
Internet
   |
   v
TLS / Load Balancer
   |
   v
Notification Engine
   |
   +--> PostgreSQL private network
   +--> Redis private network
   +--> Kafka private network
   +--> RabbitMQ private network
   +--> External provider APIs
```

Checklist:

- [ ] HTTPS enabled.
- [ ] HTTP redirected to HTTPS where appropriate.
- [ ] PostgreSQL not publicly exposed.
- [ ] Redis not publicly exposed.
- [ ] Kafka not publicly exposed.
- [ ] RabbitMQ not publicly exposed.
- [ ] RabbitMQ management interface restricted.
- [ ] Firewall/security groups use least privilege.
- [ ] Outbound access limited to required provider endpoints where practical.

---

# 23. Backup and disaster recovery

## PostgreSQL

- [ ] Automated backups enabled.
- [ ] Backup retention configured.
- [ ] Point-in-time recovery configured where supported.
- [ ] Restore procedure documented.
- [ ] Restore test completed.

## Redis

Redis contains low-latency application state rather than authoritative notification history.

- [ ] Determine whether Redis persistence is required for the production configuration.
- [ ] Document cache rebuild behavior.
- [ ] Test application recovery after Redis loss.

## Kafka

- [ ] Topic retention configured.
- [ ] Replication configured.
- [ ] Consumer group recovery tested.
- [ ] Offset recovery procedure documented.

---

# 24. Scaling

## Application

- [ ] Minimum replica count configured.
- [ ] Maximum replica count configured.
- [ ] CPU/memory limits configured.
- [ ] Horizontal scaling policy configured.
- [ ] Graceful shutdown verified during scale-down.

## Kafka consumers

- [ ] Consumer concurrency configured.
- [ ] Topic partitions support required parallelism.
- [ ] Consumer lag monitored.
- [ ] Consumers scale based on lag and processing latency.

## PostgreSQL

- [ ] Connection pool limits reviewed.
- [ ] Active connections monitored.
- [ ] Slow queries monitored.
- [ ] Partition growth monitored.
- [ ] Index performance reviewed as data volume grows.

## Redis

- [ ] Memory monitored.
- [ ] Connections monitored.
- [ ] Cache behavior monitored.
- [ ] Capacity reviewed against expected traffic.

---

# 25. Production deployment sequence

## Step 1 — Freeze and verify release

```powershell
git status
git log --oneline -n 10
```

- [ ] Correct release commit identified.
- [ ] Working tree clean.

## Step 2 — Run quality checks

```powershell
npm run format
npm run typecheck
npm run lint
npm test
```

- [ ] Format passes.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Tests pass.

## Step 3 — Build image

```powershell
docker build -t notification-engine:production .
```

- [ ] Image builds successfully.

## Step 4 — Provision/update infrastructure

- [ ] PostgreSQL healthy.
- [ ] Redis healthy.
- [ ] Kafka healthy.
- [ ] RabbitMQ healthy if required.

## Step 5 — Apply migrations

```powershell
npm run db:migrate
```

- [ ] Backup exists.
- [ ] Migrations succeed.

## Step 6 — Deploy application

- [ ] Correct production image deployed.
- [ ] Secrets injected through deployment configuration.
- [ ] Correct replica count configured.

## Step 7 — Verify readiness

```text
/live
/ready
/health
/health/providers
```

- [ ] All expected checks pass.

## Step 8 — Run smoke test

- [ ] Controlled event accepted.
- [ ] Kafka processing succeeds.
- [ ] Delivery pipeline completes.
- [ ] Database state updates.
- [ ] Analytics update.
- [ ] Correlation ID visible in logs.

## Step 9 — Observe

Monitor error rate, latency, Kafka lag, provider failures, delivery success rate, retry rate, DLQ depth, database connections, and Redis health.

## Step 10 — Enable normal traffic

Only after the smoke test and operational checks succeed.

---

# 26. Rollback procedure

If the new release causes production problems:

1. Reduce or stop traffic to the affected release.
2. Preserve logs and metrics.
3. Determine whether the issue is application-only or migration-related.
4. Roll back the application image to the previous release.
5. Verify `/live`, `/ready`, and `/health`.
6. Verify Kafka consumers recover.
7. Verify notification processing resumes.
8. Monitor retry and DLQ activity.
9. Do not automatically reverse destructive database migrations.
10. Use the reviewed database rollback or restore procedure when required.

Application releases should remain compatible with the currently deployed database schema whenever possible.

---

# 27. Post-deployment verification

During the first monitoring window:

- [ ] HTTP traffic is normal.
- [ ] No unexpected 5xx spike.
- [ ] Kafka consumer lag is stable.
- [ ] Notification throughput is expected.
- [ ] Delivery success rate is expected.
- [ ] Provider failure rate is normal.
- [ ] Circuit breakers are not unexpectedly open.
- [ ] Retry volume is normal.
- [ ] DLQ depth is stable.
- [ ] PostgreSQL connections are healthy.
- [ ] Redis memory/connections are healthy.
- [ ] No unexpected security alerts.
- [ ] No configuration errors.
- [ ] Logs are searchable.
- [ ] Metrics are being collected.

---

# 28. Final release checklist

## Code

- [ ] Final code committed.
- [ ] Working tree clean.
- [ ] TypeScript build passes.
- [ ] Lint passes.
- [ ] Formatting passes.
- [ ] Full test suite passes.
- [ ] Coverage report generated.

## Infrastructure

- [ ] PostgreSQL healthy.
- [ ] Redis healthy.
- [ ] Kafka healthy.
- [ ] RabbitMQ healthy if required.
- [ ] Persistent storage configured.
- [ ] Resource limits configured.

## Application

- [ ] Production image built.
- [ ] Runtime uses non-root user.
- [ ] Production environment variables injected.
- [ ] Migrations applied.
- [ ] Health checks pass.
- [ ] API smoke test passes.
- [ ] Kafka ingestion verified.
- [ ] Delivery path verified.

## Reliability

- [ ] Retry verified.
- [ ] DLQ verified.
- [ ] Provider failover verified.
- [ ] Circuit breaker verified.
- [ ] Graceful shutdown verified.

## Security

- [ ] No production secrets in Git.
- [ ] No production secrets in image.
- [ ] Dependency audit passes.
- [ ] Snyk validation passes according to release policy.
- [ ] HTTPS configured.
- [ ] Private infrastructure network configured.

## Observability

- [ ] Logs centralized.
- [ ] Metrics collected.
- [ ] Alerts configured.
- [ ] Kafka lag monitored.
- [ ] Provider health monitored.
- [ ] DLQ monitored.

## Documentation

- [ ] `README.md` updated.
- [ ] `ARCHITECTURE.md` updated.
- [ ] `CHANGELOG.md` updated.
- [ ] `DEPLOYMENT.md` updated.
- [ ] OpenAPI documentation current.
- [ ] Production runbook available.

## Submission

- [ ] Repository history intact.
- [ ] Required collaborator/ownership changes completed.
- [ ] Final Day 15 commit created.
- [ ] Repository transfer verified.
- [ ] Final branch state verified.

---

# 29. Operational command reference

### Start local production-like stack

```powershell
docker compose up -d --build
```

### Check services

```powershell
docker compose ps
```

### View logs

```powershell
docker compose logs
```

### Stop stack

```powershell
docker compose down
```

### Run migrations

```powershell
cd backend
npm run db:migrate
```

### Build backend

```powershell
npm run build
```

### Quality checks

```powershell
npm run format
npm run typecheck
npm run lint
npm test
```

### Security audit

```powershell
npm audit --audit-level=high
```

### Build production image

```powershell
docker build -t notification-engine:production .
```

---

# 30. Deployment principle

The production deployment should preserve the architectural guarantees established during development:

```text
Validate
   ↓
Publish
   ↓
Process asynchronously
   ↓
Apply preferences and compliance
   ↓
Render
   ↓
Route
   ↓
Deliver resiliently
   ↓
Track
   ↓
Analyze
   ↓
Retry or DLQ on failure
```

A release should be considered production-ready only after the application, infrastructure, provider integrations, observability, security controls, and recovery paths have been verified together.
