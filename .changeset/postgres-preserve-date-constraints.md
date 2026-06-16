---
'@agendajs/postgres-backend': patch
---

Persist and restore `startDate`, `endDate` and `skipDays` in the Postgres backend. These were not columns in the schema, were not written by `saveJob`, and were not read by `rowToJob`, so a job saved with date constraints lost them entirely, silently disabling its start/end window and skipped days. Adds the columns and wires them through every save path and the row mapping.
