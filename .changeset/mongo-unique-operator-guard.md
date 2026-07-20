---
'@agendajs/mongo-backend': patch
---

Reject server-side-evaluation operators (`$where`, `$function`, `$expr`, `$accumulator`) in `unique()` constraints. They have no use in a uniqueness key and could allow query injection when the key is built from untrusted input. Ordinary equality and comparison constraints are unchanged.
