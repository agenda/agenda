---
'@agendajs/mongo-backend': patch
---

Preserve `startDate`, `endDate`, and `skipDays` when reading jobs from MongoDB. `computeJobObj` did not map these fields, so they were lost on every read. A repeating job therefore lost its date constraints after the first run and could be rescheduled onto skipped days or outside its start/end window.
