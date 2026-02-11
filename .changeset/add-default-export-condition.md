---
"agenda": patch
"@agendajs/mongo-backend": patch
"@agendajs/postgres-backend": patch
"@agendajs/redis-backend": patch
"agenda-rest": patch
"agendash": patch
---

Add "default" export condition to all packages to support CommonJS require()

The exports map only specified the "import" condition, which prevented CommonJS projects from using require() to load these packages. Node.js require() matches "require" or "default" conditions, not "import". With require(esm) now stable in Node.js 20.19+, 22.12+, and 24+, adding a "default" condition allows CJS projects to consume these ESM packages directly.
