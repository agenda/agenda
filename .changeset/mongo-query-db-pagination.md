---
'@agendajs/mongo-backend': patch
---

Push skip/limit to the database in queryJobs when no state filter is requested, instead of loading the entire matching collection into memory. Prevents out-of-memory on large collections (#1713, #1712).
