---
'agenda': patch
---

Clear armed near-future job timers on `stop()`/`drain()`. Previously the JobProcessor armed an untracked `setTimeout` for jobs due within the `processEvery` window; it was never cleared, kept the event loop alive after `stop()`, and for recurring jobs with an interval ≤ `processEvery` could re-arm itself indefinitely — so the process never exited. Timers are now tracked, cleared on teardown, and `unref`'d so an armed timer alone can never block process exit.
