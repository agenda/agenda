---
'@agendajs/postgres-backend': patch
---

Persist `failReason`, `failCount`, and `failedAt` when a job is inserted with failure state. Previously these columns were only written on the UPDATE path, so a brand-new job saved with failure state lost it.
