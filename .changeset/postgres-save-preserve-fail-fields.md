---
'@agendajs/postgres-backend': patch
---

Don't wipe `failReason`, `failCount`, and `failedAt` when saving an existing job without failure state. Previously the `_id` update path overwrote those columns with NULL unconditionally, so a plain `job.save()` (which strips processor-managed fields) erased failure state the processor had recorded. The columns are now only written when the caller provides them, matching the mongo backend fix for #1811 and the redis backend.
