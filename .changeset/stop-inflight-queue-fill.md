---
'agenda': patch
---

Fix `stop()` leaving a queued job locked when a lock query was still in flight. A queue fill (periodic scan or notification) whose `getNextJobToRun` completed after `stop()` had unlocked the queued jobs re-locked a job and kept it, because `jobQueueFilling()` never re-checked whether the processor was still running. Such a job is now released again, and `stop()` waits for in-flight queue fills before it resolves. This also fixes the flaky `should clear locks for queued jobs on stop` test on Postgres.
