---
'agenda': patch
---

Fix notification channel reconnect ignoring maxAttempts and never applying exponential backoff (infinite tight retry loop)
