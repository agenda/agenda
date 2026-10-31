---
'@agendajs/redis-backend': patch
---

Fix data filter to use recursive value containment instead of a JSON-substring match, preventing false matches (and wrong-job deletion) for prefix-colliding values and reordered multi-key filters.
