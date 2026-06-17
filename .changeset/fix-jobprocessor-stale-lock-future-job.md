---
'agenda': patch
---

Release the database lock when the processor frees a job whose `nextRunAt` is too far in the future. Previously such a job, when picked up via the expired-lock recovery path (for example a recurring job left locked by a crashed worker), was removed from the local locked list but never unlocked in the database, so it was re-locked on every scan and never reached its run time.
