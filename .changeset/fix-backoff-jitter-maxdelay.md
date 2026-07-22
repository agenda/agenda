---
'agenda': patch
---

Keep backoff jitter within `maxDelay`. `applyJitter` could add up to `jitter * delay` on top of the already-capped delay, so a jittered retry delay could exceed the documented `maxDelay` hard cap. The jittered result is now clamped to `[0, maxDelay]`.
