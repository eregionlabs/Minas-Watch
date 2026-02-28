# Minas Watch

Schema-first MVP bootstrap for an early-warning intelligence dashboard, now including a no-database war news stream app.

## What exists now
- Design spec: `DESIGN.md`
- MVP implementation plan: `IMPLEMENTATION_PLAN.md`
- Canonical JSON schemas: `schemas/*.schema.json`
- Valid sample fixtures: `fixtures/*.sample.json`
- Validation scripts (AJV): `scripts/*.mjs`
- Express API + web UI: `src/server.mjs` + `public/*`
- In-memory RSS news fetcher with dedupe + newest-first sorting: `src/news-service.mjs`

## Quick start
```bash
npm install
npm test
npm run start
```

Open:
- `http://localhost:8787/` (live news UI)

Core endpoints:
- `GET /health`
- `GET /schemas`
- `POST /validate/:schema` (e.g. `/validate/signal`)
- `GET /api/news` (latest cached news list)
- `GET /api/news/stream` (SSE live updates)

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
The UI now includes a `Source Control` panel (left side on desktop, top on mobile) with client-side controls:

- `Active Feeds`: toggle each feed on/off using feed labels from `/api/news`.
- `Preferred Outlets`: comma-separated source names that boost matching headlines.
- `Preferred Regions / Keywords`: comma-separated terms that boost headline title matches.
- `Reset preferences`: restores defaults (all feeds active, no boosts).

Ranking is applied instantly in-browser (no reload): items are reordered by preference score, then by recency as a tie-breaker. Preferences persist in `localStorage`.

## Runtime configuration
Copy `.env.example` to `.env` and adjust as needed.

- `PORT`: API/UI port (default `8787`)
- `NEWS_REFRESH_MS`: background feed refresh cadence (default `120000`)
- `NEWS_CACHE_TTL_MS`: staleness window before refresh (default `120000`)
- `NEWS_FETCH_TIMEOUT_MS`: per-feed fetch timeout (default `7000`)
- `NEWS_MAX_ITEMS`: max deduped items retained/served (default `50`)
- `NEWS_FEEDS`: optional comma-separated RSS feed URLs

## Next implementation slice
1. Add persistence layer (Postgres + migrations)
2. Implement collector-service and normalizer-service
3. Add correlator and confidence transitions
4. Wire alert delivery adapters
5. Build operator dashboard UI
