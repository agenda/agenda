---
'@agendajs/mongo-backend': patch
---

Follow-up to #1783: restore defensive `new Date()` coercion for date fields in `saveJobState` so untyped callers passing ISO strings cannot persist strings in date fields, and remove the internal `OptionalKeysToNullable` helper type from the public exports
