---
'@agendajs/redis-backend': patch
---

Fix priority ordering for negative priorities in the Redis backend. The sorted-set score clamped every priority below `0` to the same fractional tiebreak, so jobs with equal `nextRunAt` and named priorities `normal`, `low`, and `lowest` were ordered arbitrarily instead of by priority descending. Negative priorities are now mapped into a distinct, monotonic tiebreak so higher priority always runs first, matching the Mongo and Postgres backends.
