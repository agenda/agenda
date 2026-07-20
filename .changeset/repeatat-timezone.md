---
'agenda': patch
---

Honor `repeatTimezone` when computing `nextRunAt` from `repeatAt`. Previously the
`repeatAt` time-of-day was resolved only in the server's local timezone, so a job
with `repeatAt: '3:30pm'` and `repeatTimezone: 'Asia/Tokyo'` would fire at the
wrong wall-clock time on a non-Tokyo server. The parsed time is now reinterpreted
in the configured timezone, matching the cron interval path.
