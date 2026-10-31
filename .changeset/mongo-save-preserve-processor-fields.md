---
"@agendajs/mongo-backend": patch
---

Fix `saveJob` nulling processor-managed fields (`lockedAt`, `lastRunAt`, `failCount`, ...) on existing jobs. `job.save()` from a running job, re-calling `every()` for a `single` job, and saving a `unique()` job that matches an existing one no longer clear the lock or run history. New jobs still get explicit `null` defaults.
