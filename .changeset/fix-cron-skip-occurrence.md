---
'agenda': patch
---

Fix recurring cron jobs skipping a valid occurrence. `computeFromInterval` compared the next cron tick against the stored `nextRunAt`, so when `nextRunAt` was further in the future than the next tick after `lastRunAt`, it bumped past and skipped the legitimate occurrence. It now only re-rolls when the tick is not strictly after `lastRunAt`.
