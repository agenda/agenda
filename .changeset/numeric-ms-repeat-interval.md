---
'agenda': patch
---

Treat a numeric (or purely-numeric string) repeatInterval as milliseconds in computeFromInterval, so recurring jobs scheduled with `agenda.every(5000, 'job')` keep running on backends that persist the interval as a string.
