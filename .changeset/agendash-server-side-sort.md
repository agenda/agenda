---
"agendash": patch
---

Sort the job list on the server. The API always sorted by `nextRunAt` (desc) and returned 50 jobs, and clicking a column only re-sorted those 50 in the browser. On the "All jobs" page this could show only jobs due far in the future (for example every row "5 days ago") and hide jobs that ran recently (#1802). Column clicks now pass `sortBy` (`name`, `nextRunAt`, `lastRunAt`, `lastFinishedAt`) and `sortDir` (`asc`/`desc`) to `/api`, so the database sorts all jobs before paging. Without these parameters the API keeps its previous `nextRunAt` desc order.
