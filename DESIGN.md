# Minas Watch — Intelligence Dashboard Design

## Purpose
Minas Watch is an early-warning intelligence dashboard designed to surface high-impact geopolitical/security signals faster than mainstream media while preserving verification discipline.

Core objective:
- **Speed with accountability** (early detection + traceable evidence + confidence scoring)

Core outputs:
1. Real-time signal feed
2. Verification board (`Unverified` / `Likely` / `Confirmed`)
3. Source reliability intelligence
4. Geo-temporal event map
5. Audit trail for every alert decision

---

## 1) Sources (Primary Value Layer)

The edge of Minas Watch is source design. Sources are organized in a 4-layer model (instead of 3) to separate truly raw edge signals from strategic context.

## Layer A — First-Signal Sources (Fastest, noisiest)
Purpose: earliest possible hint that something happened.

Includes:
- Local eyewitness posts (X, Telegram channels, Instagram, TikTok where relevant)
- Local city reporters and on-the-ground freelancers
- Community incident channels (traffic, emergency chatter, local update groups)
- Local-language niche forums/channels

Collection method:
- Curated watchlists by city/region/theme
- Keyword+location triggers
- Burst detection (multiple posts in short time window)

Risks:
- Reposts of old media
- Coordinated disinformation
- Emotionally amplified but inaccurate claims

---

## Layer B — Physical / Technical Reality Signals (Fast-medium, high truth value)
Purpose: validate if a real-world phenomenon likely occurred.

Includes:
- Aviation movement anomalies (ADS-B Exchange/OpenSky)
- Maritime movement anomalies (MarineTraffic/VesselFinder)
- Thermal/fire detections (NASA FIRMS)
- Satellite imagery updates (Sentinel/Copernicus where available)
- NOTAM/NAVWARN restrictions
- Airport disruption indicators (reroutes, cancellations spikes)
- Infrastructure outage feeds (power/network where available)

Value:
- Harder to fake than social claims
- Enables fast corroboration

Risks:
- Overinterpretation (e.g., fire signature ≠ attack certainty)
- Delayed sensor refresh in some geographies

---

## Layer C — Institutional / Official Signals (Slower, high legitimacy)
Purpose: institutional confirmation and legal/policy context.

Includes:
- Government / military spokesperson channels
- Civil defense, police, transport authorities
- Embassy security advisories
- Regulatory notices and emergency directives

Value:
- Confirmation quality
- Policy implication signals (airspace closure, mobilization orders, etc.)

Risks:
- Strategic messaging bias
- Delayed disclosure

---

## Layer D — Analytical Context Sources (Slowest, strategic framing)
Purpose: estimate second-order implications and trajectory.

Includes:
- Tier-1 wires (Reuters/AP/Bloomberg)
- Specialist OSINT analysts with verified track records
- Think-tank rapid notes
- Regional expert newsletters and analyst briefings

Value:
- Better interpretation and scenario planning
- Helps avoid tactical tunnel vision

Risks:
- Narrative lock-in
- Analyst ideology bias

---

## Source Enrichment & Reliability Framework
Every source gets metadata and dynamic reliability scoring.

Source metadata:
- Region(s), language(s), topic domain(s)
- Type: eyewitness / sensor / official / analyst
- Historical false-positive rate
- Correction behavior quality
- Original-content ratio (vs repost behavior)

Reliability score (0–100):
- Accuracy history: 40%
- Latency advantage: 20%
- Evidence quality: 15%
- Independence/originality: 15%
- Correction integrity: 10%

Additional anti-manipulation checks:
- Reverse media matching (reused videos/images)
- Temporal consistency checks (old clip recirculation)
- Geolocation plausibility checks
- Coordinated amplification pattern detection

---

## 2) Architecture

## High-Level Architecture
1. **Collectors** ingest multi-source data streams
2. **Normalizer** converts raw inputs to a canonical event schema
3. **Enrichment pipeline** adds geotags, entity extraction, language translation, media hashes
4. **Correlation engine** merges duplicate/related claims into incident clusters
5. **Scoring engine** computes source trust + claim confidence
6. **Rule engine** decides alert severity and routing
7. **Storage layer** preserves raw evidence + enriched records + audit log
8. **API layer** serves dashboard, search, and alert subscriptions
9. **UI** renders operational and executive views

---

## Core Data Model (Simplified)
- `source`
  - id, type, region, language, reliability_score, stats
- `signal`
  - id, source_id, timestamp, text/media, location_guess, entities
- `incident`
  - id, title, location, status, confidence, first_seen, last_updated
- `evidence`
  - id, incident_id, signal_id, media_hash, verification_flags
- `alert`
  - id, incident_id, severity, trigger_reason, recipients, sent_at
- `audit_log`
  - id, actor(system/user), action, before/after, timestamp

---

## Processing & Alert Logic
Incident status transitions:
- `Unverified`:
  - Single weak source or incomplete evidence
- `Likely`:
  - Two independent Layer A sources within temporal+geo proximity
  - OR one Layer A + one Layer B corroboration
- `Confirmed`:
  - Official/Layer C confirmation + independent technical/evidence support

Alert severities:
- P1: immediate, high-impact, multi-source corroborated
- P2: credible developing event, partial corroboration
- P3: watchlist-level weak/early signal

Notification throttling:
- Deduplicate near-identical alerts
- Escalate only on confidence or impact change
- Suppress repost-only noise

---

## Storage & Audit Requirements
- Immutable raw evidence snapshots
- Versioned incident timeline (what changed, when, why)
- Explainability record for each confidence score
- Manual analyst override log with rationale

Audit intent:
- Reconstruct every decision path after the fact
- Defend against “why did we alert / why didn’t we alert?”

---

## Suggested Implementation Path
Phase 1 (MVP):
- Curated source lists + keyword triggers + manual verification board
- Basic incident clustering and confidence labels

Phase 2:
- Automated enrichment/correlation/scoring
- Push notifications and escalation policies

Phase 3:
- Reliability model tuning, false-positive analytics, source leaderboards
- Multi-language intelligence expansion and model-assisted triage

---

## 3) UI Design (Pleasant + High-Throughput Insight Digestion)

Design principle: **beautiful, calm, and information-dense without being overwhelming**.

## Visual Style
- Dark neutral base + restrained accent colors
- Semantic color system:
  - Red: confirmed high-risk
  - Amber: likely developing
  - Blue/Gray: unverified/watch
  - Green: resolved/cleared
- Clear typography hierarchy:
  - H1 incident name
  - H2 operational context
  - compact mono for timestamps/IDs
- Generous spacing, subtle shadows, clear card grouping

---

## Primary Layout
### Left Sidebar (Navigation + Filters)
- Regions, topics, source layers, confidence filters
- Saved views (e.g., Gulf, Levant, Maritime chokepoints)

### Top Bar (Global Situation Strip)
- Active incidents count by status
- New signals last 15/60 min
- Data freshness indicator
- Alert health indicator

### Main Center (Three-Pane Intelligence Layout)
1. **Live Incident Stream** (most actionable first)
2. **Geo Map + Heat Layer** (cluster and spread awareness)
3. **Verification Board** (Unverified → Likely → Confirmed columns)

### Right Drawer (Context on Demand)
- Selected incident timeline
- Evidence stack (media, source, sensor corroboration)
- Confidence breakdown with explanation
- Analyst notes and override controls

---

## Information Hierarchy Rules
1. Show impact + confidence before narrative text
2. Surface “what changed” prominently
3. Keep raw evidence one click away
4. Distinguish fact vs inference visually

Fact/Inference rendering:
- Facts: solid badges + source references
- Inferences: dotted badges + assumption list

---

## Interaction Patterns for Fast Cognition
- Keyboard-first triage shortcuts
- Hover previews for sources/media
- One-click "evidence only" mode
- Time-scrub replay of incident progression
- Instant pivot from incident to source reliability history

---

## Dashboard Views by Persona
### Operator View (real-time)
- Dense stream, map, verification columns, alert controls

### Executive View (decision)
- Fewer elements, larger trend indicators, scenario summary cards

### Audit View (post-event)
- Full timeline reconstruction + score/explanation snapshots

---

## UX Guardrails
- Never hide uncertainty; display confidence and evidence count at all times
- Avoid alarmist color saturation on weak claims
- Preserve a calm visual rhythm to reduce analyst fatigue
- Preserve provenance at every layer (who said what, when, and based on what)

---

## Success Metrics
- Median detection lead time vs mainstream reports
- False positive rate by severity tier
- Time-to-confirmation from first signal
- Source reliability drift over time
- Analyst workload and alert fatigue indicators

---

## Final Design Principle
Minas Watch should feel like a strategic operations console: elegant, fast, evidence-first, and brutally clear about uncertainty.
