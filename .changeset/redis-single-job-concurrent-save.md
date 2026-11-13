---
'@agendajs/redis-backend': patch
---

Fix duplicate `single` jobs in the Redis backend when the same job is saved concurrently. Checking for an existing single job and creating a new one were separate round trips, so several workers calling `agenda.every()` for the same name at startup each created their own copy and the job ran once per worker on every interval. The create step now runs as one Lua script that returns the existing job if another worker created it first, matching the unique index the Postgres backend uses.
