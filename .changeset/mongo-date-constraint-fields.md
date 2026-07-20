---
'@agendajs/mongo-backend': patch
---

Map `startDate`, `endDate` and `skipDays` from MongoDB documents to job objects so date constraints on repeating jobs survive a reload from the database (previously a repeating job with an `endDate` would keep running forever after its first execution)
