---
"agenda": patch
"@agendajs/postgres-backend": patch
"@agendajs/redis-backend": patch
---

Fix outdated documentation: rename `jobs()` to `queryJobs()`, update sort values to use `'asc'`/`'desc'` strings, fix sandboxed worker example to use pluggable backend API, correct MongoDB backend package name in comparison table, and rewrite connection recovery section to be backend-agnostic.
