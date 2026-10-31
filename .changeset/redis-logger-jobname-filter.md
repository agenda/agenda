---
'@agendajs/redis-backend': patch
---

Fix RedisJobLogger.getLogs to apply the jobName filter when jobId is also supplied, matching the AND semantics of the Mongo/Postgres loggers.
