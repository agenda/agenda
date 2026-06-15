---
'agenda': patch
---

Surface notification handler errors consistently. A subscriber that threw synchronously emitted an `error` event, but one that returned a rejected promise was swallowed by `Promise.allSettled`. Rejected async handlers (for both job and state notifications) now emit `error` like synchronous throws.
