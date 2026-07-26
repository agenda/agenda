---
'agenda': patch
---

Emit `progress` and `progress:<name>` events locally when `job.touch(progress)` is called, matching the local-emit pattern used by other job lifecycle events.
