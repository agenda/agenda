---
'agenda': patch
---

Keep backoff jitter within `maxDelay`. `applyJitter` could add up to `jitter * delay` on top of the already-capped delay, so a jittered retry delay could exceed the documented `maxDelay` hard cap. The jittered result now stays within `[0, maxDelay]`; overshoots are reflected below the cap rather than clamped, so retries at the cap stay spread out.
