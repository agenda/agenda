---
'agenda': patch
---

Clear a running job's watchdog timer as soon as the job finishes so it cannot keep the Node.js process alive during shutdown.
