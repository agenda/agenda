---
'agenda': patch
---

Fix `drain()` leaving prefetched jobs locked. `drain()` only waited for running jobs and then dropped the job processor, so jobs that were locked but never started kept their `lockedAt` and a following `stop()` could not release them. `drain()` now unlocks those jobs (running jobs keep their locks) before it disconnects.
