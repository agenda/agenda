---
'agenda': patch
---

`stop()` no longer unlocks jobs that are still running, preventing duplicate concurrent execution of the same job occurrence on another instance during rolling restarts. Only jobs that are locked locally but have not started running are unlocked; running jobs keep their database lock until they complete (or `lockLifetime` expires if the process dies).
