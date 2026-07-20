---
'@agendajs/mongo-backend': patch
---

Conform to the MongoDB Stable API: replace the `distinct` command in `getDistinctJobNames()` with a `$group` aggregation, so the backend works with clients configured with `apiStrict: true`
