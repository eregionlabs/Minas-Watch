# Minas Watch — MVP Implementation Plan

## 0) MVP Scope
Build an operational v1 that can:
1. ingest multi-source signals,
2. normalize and store evidence,
3. cluster signals into incidents,
4. assign confidence (`UNVERIFIED` / `LIKELY` / `CONFIRMED`),
5. trigger basic alerts,
6. provide an analyst dashboard + audit history.

Out of scope for MVP:
- advanced ML ranking,
- full multilingual NLP fine-tuning,
- mobile native app,
- full SOC-style role-based access controls.

---

## 1) Target Architecture (MVP)

### Core services
- **collector-service**: pulls from source connectors on schedule/webhooks.
- **normalizer-service**: converts raw events to canonical `signal` schema.
- **correlator-service**: dedup + incident clustering.
- **scoring-service**: source reliability + claim confidence.
- **alert-service**: severity routing and suppression logic.
- **api-service**: read/write APIs for UI.
- **web-ui**: operator dashboard.

### Data stores
- **Postgres**: normalized entities (`source`, `signal`, `incident`, `alert`, `audit_log`).
- **Object storage (S3-compatible)**: raw payload snapshots/media for immutable evidence.
- **Redis**: queue/cache/rate-limit state.

### Infra
- Docker Compose for dev,
- CI with lint/test/schema validation,
- one cloud deployment target (staging first).

---

## 2) Work Breakdown (MVP)

## Phase A — Foundation (Days 1–3)
### A1. Repo structure + env bootstrapping
- [ ] Add `apps/` and `packages/` layout
- [ ] Add `.env.example` with connector secrets placeholders
- [ ] Add Docker Compose (postgres + redis + api)
- [ ] Add migration system (Prisma/Knex/Flyway)

**Acceptance criteria**
- `docker compose up` starts all core dependencies
- App health endpoints return 200

### A2. Schema-first development
- [ ] Add JSON schemas (source/signal/incident/evidence/alert/audit_log)
- [ ] Add schema validation in CI
- [ ] Add DB schema aligned to JSON schemas

**Acceptance criteria**
- Example fixtures validate successfully
- DB migrations apply cleanly on fresh instance

---

## Phase B — Data Ingestion + Correlation (Days 4–7)
### B1. Collector connectors (MVP minimal set)
- [ ] Connector: curated social/watchlist feed ingestion
- [ ] Connector: manual analyst submit endpoint
- [ ] Connector: one technical feed (e.g., NOTAM or FIRMS mock/stub)

**Acceptance criteria**
- Signals from each connector are persisted as raw + normalized records
- Connector failures are retried with backoff and logged

### B2. Normalization pipeline
- [ ] Canonical field mapping
- [ ] Language detection + timestamp normalization
- [ ] Entity extraction (location/source/topic tags)
- [ ] Media hash generation for duplicate detection

**Acceptance criteria**
- >=95% of fixture signals map into canonical model without manual edits

### B3. Correlation engine
- [ ] Near-duplicate detection (hash + text similarity)
- [ ] Incident clustering by geo/time/topic
- [ ] Incident timeline append-only event history

**Acceptance criteria**
- Duplicate reposts merge into existing incidents
- Incident timeline tracks all linked evidence

---

## Phase C — Confidence + Alerts (Days 8–10)
### C1. Reliability and confidence scoring
- [ ] Source reliability score with weighted formula
- [ ] Incident confidence status transition logic
- [ ] Explainability payload (why a score changed)

**Acceptance criteria**
- Incident cards show confidence + reason codes
- Status transitions are deterministic from evidence inputs

### C2. Alert rules engine
- [ ] P1/P2/P3 severity mapping
- [ ] Suppression of repost-only updates
- [ ] Escalate on confidence delta or impact delta
- [ ] Telegram/Slack webhook notification adapter

**Acceptance criteria**
- Simulated fixtures trigger expected alert tiers
- No duplicate alert spam for repeated reposts

---

## Phase D — Operator UI + Audit (Days 11–14)
### D1. Dashboard UI (operator-first)
- [ ] Live incident stream
- [ ] Verification board columns
- [ ] Incident detail drawer with evidence list
- [ ] Source reliability panel
- [ ] Map panel (basic markers/clusters)

**Acceptance criteria**
- Analyst can triage top events in <90 seconds
- Evidence provenance visible in <=2 clicks

### D2. Audit and governance
- [ ] Immutable raw evidence references
- [ ] Audit log on all status changes and manual overrides
- [ ] Exportable incident report JSON/CSV

**Acceptance criteria**
- Full incident reconstruction possible from audit trail

---

## 3) Prioritized Backlog (Task IDs)

## P0 (must-have for MVP)
- MW-001 Repo/bootstrap
- MW-002 JSON schemas + DB migrations
- MW-003 Connector framework + 2 connectors
- MW-004 Normalizer pipeline
- MW-005 Correlation + dedup
- MW-006 Confidence state machine
- MW-007 Alert rules + webhook notifier
- MW-008 Operator dashboard core views
- MW-009 Audit logging

## P1 (next immediately after MVP)
- MW-010 Source performance leaderboard
- MW-011 Reverse-image/video lookup automation
- MW-012 Multilingual translation pipeline
- MW-013 Advanced map layers and geo-fencing

## P2 (later)
- MW-014 ML-assisted anomaly detection
- MW-015 Persona-specific views (executive vs operator)
- MW-016 Mobile-first push triage interface

---

## 4) Definition of Done (MVP)
MVP is complete when:
1. at least 3 source connectors ingest continuously,
2. incidents auto-form from correlated signals,
3. confidence status updates are explainable,
4. alerting works with suppression and escalation,
5. dashboard supports live triage,
6. full audit trail can reconstruct any incident lifecycle.

---

## 5) QA / Validation Plan
- Unit tests: schema validation, scoring, transition rules.
- Integration tests: connector -> normalization -> incident -> alert.
- Replay tests: run historical fixture bundles to measure:
  - lead-time,
  - false-positive rate,
  - duplicate suppression efficiency.

Target MVP quality bars:
- <5% schema-validation failure on valid fixtures,
- >80% duplicate repost suppression,
- <2 min median pipeline latency from ingest to UI visibility.

---

## 6) Risks & Mitigations
- **API/source instability** → adapter abstraction + retries + dead-letter queue.
- **Disinformation bursts** → source scoring + media hash checks + analyst override.
- **Alert fatigue** → suppression rules + severity thresholds + quiet hours.
- **Overfitting confidence logic** → explicit reason codes + replay tests.

---

## 7) Delivery Milestones
- **M1 (end Week 1):** ingest + normalize + incident clustering working.
- **M2 (mid Week 2):** confidence + alerting operational.
- **M3 (end Week 2):** dashboard + audit complete (MVP ready for review).

---

## 8) Audit Trail Note
All scoring and status-change decisions must include machine-readable reason codes and timestamps to preserve post-incident accountability and enable model/rule tuning.
