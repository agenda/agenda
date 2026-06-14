---
'@agendajs/postgres-backend': patch
---

Prevent SQL injection through `unique()` constraint keys. JSON paths are now bound as query parameters and column names are validated against the table's columns, instead of being concatenated into the SQL.
