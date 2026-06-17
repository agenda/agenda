---
'@agendajs/mongo-backend': patch
'@agendajs/postgres-backend': patch
'@agendajs/redis-backend': patch
---

Fix `getJobsOverview` double-counting disabled jobs. A disabled job was counted in both its computed state bucket and the `paused` bucket, so the per-state buckets summed to `total + (number of disabled jobs)`. Disabled jobs are now counted only as `paused`, consistent with the list view.
