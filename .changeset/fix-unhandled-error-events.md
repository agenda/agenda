---
"agenda": patch
---

Prevent unhandled 'error' events from crashing the process by registering a default no-op listener in the Agenda constructor.