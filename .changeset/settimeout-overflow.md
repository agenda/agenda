---
'agenda': patch
---

Clamp near-future `setTimeout` delays to `2^31 - 1` ms. Node.js treats delays larger than a signed 32-bit integer as an overflow and clamps them to 1 ms, causing the JobProcessor to immediately reprocess a far-future job. The new ceiling matches Node's actual limit and prevents immediate reprocessing when `processEvery` is configured larger than that job's delay.
