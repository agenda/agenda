---
'agenda': patch
---

Fix start() race where concurrent calls leaked a second JobProcessor and connected the notification channel twice
