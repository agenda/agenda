---
'agenda': patch
---

Fix three scheduling bugs:

- The processing queue placed the highest-priority (or earliest) job in the slot that runs last, so jobs queued in the same tick ran in reverse priority order.
- `@Every` jobs registered after the agenda was already ready were never scheduled, because the scheduler relied on a one-shot `ready` event that had already fired.
- A recurring job's backoff retry counter was never reset after a successful run, so a job that had exhausted its retries earlier in its lifetime stopped retrying.
