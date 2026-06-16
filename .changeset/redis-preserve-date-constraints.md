---
'@agendajs/redis-backend': patch
---

Persist and restore `startDate`, `endDate` and `skipDays` in the Redis backend. These fields were never written by `jobToHash` nor read by `hashToJob`, so a job saved with date constraints lost them on every reload, silently disabling its start/end window and skipped days.
