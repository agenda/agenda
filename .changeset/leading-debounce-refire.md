---
'@agendajs/mongo-backend': patch
'@agendajs/postgres-backend': patch
'@agendajs/redis-backend': patch
---

Fix leading-strategy debounce never re-firing after its window elapsed (the debounce window was never reset once the job ran)
