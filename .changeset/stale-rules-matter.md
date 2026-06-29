---
'@agendajs/mongo-backend': patch
---

Extended the saved Job type to have explicit null values instead of undefined and stopped relying on the MongoDb driver "ignoreUndefined" flag to set them
