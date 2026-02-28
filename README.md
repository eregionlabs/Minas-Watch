# Minas Watch

Schema-first MVP bootstrap for an early-warning intelligence dashboard, including a no-database war news stream app with curated first-hand OSINT emphasis.

## What exists now
- Design spec: `DESIGN.md`
- MVP implementation plan: `IMPLEMENTATION_PLAN.md`
- Canonical JSON schemas: `schemas/*.schema.json`
- Valid sample fixtures: `fixtures/*.sample.json`
- Validation scripts (AJV): `scripts/*.mjs`
- Express API + web UI: `src/server.mjs` + `public/*`
- In-memory RSS news fetcher with dedupe + first-hand-prioritized ranking: `src/news-service.mjs`
- Curated source catalog metadata per feed (`sourceType`, `trustTier`, `firstHand`, `regionTags`, `basePriority`)

## Quick start
```bash
npm install
npm test
npm run start
```

Open:
- `http://localhost:8787/` (live news UI)

## GitHub Pages
This repo includes static files at:
- `/index.html` (root Pages source)
- `/docs/index.html` (docs Pages source)

GitHub Pages renders the UI shell and loads API origin from `config.js`.
Live headlines require the Node API endpoints (`/api/news` and `/api/news/stream`) hosted separately.

Current temporary API host:
- `https://avoiding-decisions-months-varying.trycloudflare.com` (Cloudflare Quick Tunnel; ephemeral)

To point Pages at a new backend, update `config.js` (`window.MINAS_WATCH_API_BASE`).

Core endpoints:
- `GET /health`
- `GET /schemas`
- `POST /validate/:schema` (e.g. `/validate/signal`)
- `GET /api/news` (latest cached news list + source metadata)
- `GET /api/news/stream` (SSE live updates + source metadata)

## First-hand OSINT mode
The default feed catalog mixes:
- First-hand `official`, `osint_social`, and `sensor` feeds (higher priority)
- Contextual `wire` feeds (lower priority, still included)

UI controls now include a prominent `First-hand only` toggle.
When enabled, headlines are filtered to sources marked `firstHand=true`.
The toggle persists in `localStorage` with existing source preferences.

Each headline and feed carries source metadata:
- `sourceType`: `official`, `osint_social`, `sensor`, `wire`
- `trustTier`: 1-5 baseline trust indicator (5 is highest)
- `firstHand`: whether the feed is classified as near-primary signal

## Source caveats
- Official and social sources can be biased, incomplete, delayed, or incorrect.
- Social OSINT signals are leads, not confirmations.
- Always verify high-impact claims with corroborating sources before action.

## Example validation request
```bash
curl -s http://localhost:8787/validate/signal \
  -H 'content-type: application/json' \
  --data-binary @fixtures/signal.sample.json
```

## Example news request
```bash
curl -s http://localhost:8787/api/news | jq
```

## Source Control Panel
The UI includes a `Source Control` panel with client-side controls:

- `First-hand only`: filters to feeds marked as first-hand.
- `Active Feeds`: toggle each feed on/off using feed labels from `/api/news`.
- `Preferred Outlets`: comma-separated source names that boost matching headlines.
- `Preferred Regions / Keywords`: comma-separated terms that boost headline title matches.
- `Reset preferences`: restores defaults (all feeds active, first-hand mode off, no boosts).

Ranking is applied instantly in-browser (no reload): items are reordered by preference score, then by recency as a tie-breaker. Preferences persist in `localStorage`.

## Runtime configuration
Copy `.env.example` to `.env` and adjust as needed.

- `PORT`: API/UI port (default `8787`)
- `NEWS_REFRESH_MS`: background feed refresh cadence (default `120000`)
- `NEWS_CACHE_TTL_MS`: staleness window before refresh (default `120000`)
- `NEWS_FETCH_TIMEOUT_MS`: per-feed fetch timeout (default `7000`)
- `NEWS_MAX_ITEMS`: max deduped items retained/served (default `50`)
- `NEWS_FEEDS`: optional comma-separated RSS feed URLs to override the curated catalog selection

## Next implementation slice
1. Add persistence layer (Postgres + migrations)
2. Implement collector-service and normalizer-service
3. Add correlator and confidence transitions
4. Wire alert delivery adapters
5. Build operator dashboard UI
