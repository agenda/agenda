---
'agenda': patch
---

Fix processing queue order. `JobProcessingQueue.insert` placed the highest-priority (or earliest `nextRunAt`) job in the slot that runs last, because the queue is read from the end. Jobs queued in the same tick now run in the correct priority order.
