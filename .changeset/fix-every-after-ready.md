---
'agenda': patch
---

Fix `@Every` jobs registered after the agenda was already ready never being scheduled. The scheduler relied on a one-shot `ready` event that had already fired, so it now uses the `ready` promise, which stays resolved.
