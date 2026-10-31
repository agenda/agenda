---
'agenda': patch
---

Fix `job.touch()` wiping a job's `progress`. A bare `touch()` keep-alive call set `progress` to `undefined`, discarding a previously reported value. It now only updates `progress` when a value is passed.
