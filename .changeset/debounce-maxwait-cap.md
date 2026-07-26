---
'@agendajs/mongo-backend': patch
'@agendajs/postgres-backend': patch
'@agendajs/redis-backend': patch
---

Cap the trailing debounce `nextRunAt` at the `maxWait` deadline. Each save rescheduled the job to `now + delay` without bounding it by `debounceStartedAt + maxWait`, so a save shortly before the deadline pushed execution past `maxWait`, breaking the documented guarantee that the job runs within `maxWait`.
