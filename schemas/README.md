# Minas Watch JSON Schemas

These schemas define the MVP canonical data model.

Files:
- `source.schema.json`
- `signal.schema.json`
- `incident.schema.json`
- `evidence.schema.json`
- `alert.schema.json`
- `audit-log.schema.json`

Validation notes:
- All timestamps use RFC3339 `date-time`.
- IDs are UUIDs unless otherwise stated.
- `additionalProperties` is disabled for strictness in MVP.
