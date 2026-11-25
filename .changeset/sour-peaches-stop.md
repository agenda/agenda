---
'@agendajs/mongo-backend': patch
---

Fix `connect()` failing with "Unknown index plugin 'asc'" when the `sort` option contains a custom key: sort directions are now converted to `1` / `-1` before being passed to `createIndex`.
