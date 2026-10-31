---
'@agendajs/postgres-backend': patch
---

Use column inference `ON CONFLICT (name) WHERE type = 'single'` for the single-job upsert instead of the expression form `((name))`. Both match the partial unique index on PostgreSQL, but CockroachDB rejects the expression form with a syntax error (#1731).
