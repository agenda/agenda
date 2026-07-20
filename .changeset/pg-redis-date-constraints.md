---
'@agendajs/postgres-backend': patch
'@agendajs/redis-backend': patch
---

Persist and load `startDate`, `endDate` and `skipDays` so date constraints on repeating jobs are honored (previously these fields were silently dropped — a repeating job with an `endDate` would keep running forever). The PostgreSQL backend adds the `start_date`, `end_date` and `skip_days` columns automatically on connect for existing installations.
