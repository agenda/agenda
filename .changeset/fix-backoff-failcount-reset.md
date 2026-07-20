---
'agenda': patch
---

Reset a job's backoff retry counter after a successful run. A recurring job that exhausted its retries earlier in its lifetime kept the old `failCount`, so a later failure was treated as already out of retries and stopped retrying.
