# Minas Watch

Schema-first MVP bootstrap for an early-warning intelligence dashboard.

## What exists now
- Design spec: `DESIGN.md`
- MVP implementation plan: `IMPLEMENTATION_PLAN.md`
- Canonical JSON schemas: `schemas/*.schema.json`
- Valid sample fixtures: `fixtures/*.sample.json`
- Validation scripts (AJV): `scripts/*.mjs`
- Minimal API skeleton for schema validation: `src/server.mjs`

## Quick start
```bash
npm install
npm test
npm run dev
```

Then test endpoints:
- `GET /health`
- `GET /schemas`
- `POST /validate/:schema` (e.g. `/validate/signal`)

## Example validation request
```bash
curl -s http://localhost:8787/validate/signal \
  -H 'content-type: application/json' \
  --data-binary @fixtures/signal.sample.json
```

## Next implementation slice
1. Add persistence layer (Postgres + migrations)
2. Implement collector-service and normalizer-service
3. Add correlator and confidence transitions
4. Wire alert delivery adapters
5. Build operator dashboard UI
