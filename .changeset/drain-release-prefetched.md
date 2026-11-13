---
'agenda': patch
---

Fix `drain()` leaving prefetched jobs locked. `drain()` only waited for running jobs and then dropped the job processor, so jobs that were locked but never started kept their `lockedAt` and a following `stop()` could not release them. `drain()` now stops taking new work as soon as it is called: jobs that were locked but not started are released right away (running jobs keep their locks), and they are no longer started when a running job finishes during the drain.
