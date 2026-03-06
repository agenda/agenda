---
"@agendajs/redis-backend": patch
---

fix: touch() now correctly refreshes the lock in Redis, preventing long-running jobs from being re-picked up after lockLifetime elapses
