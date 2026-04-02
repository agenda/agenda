---
"agenda": patch
"@agendajs/mongo-backend": patch
"@agendajs/postgres-backend": patch
"@agendajs/redis-backend": patch
---

Add `cancelAll()` method to remove all jobs unconditionally. Also fix Redis backend ignoring `data` filter when combined with `name` in `cancel()`.
