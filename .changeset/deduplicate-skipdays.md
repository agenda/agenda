---
'agenda': patch
---

Deduplicate `skipDays` before checking whether all weekdays are skipped. Previously an array with duplicate entries (e.g. `[0, 0, 1, 2, 3, 4, 5]`) was rejected as covering every day even though a valid weekday was not skipped.
