---
'agendash': patch
---

Correct the middleware factory names in the README examples (`createExpressMiddleware`, `createKoaMiddleware`, `createFastifyPlugin`, `createHapiPlugin` — the previously documented unprefixed names do not exist) and drop an unused `koa-router` import from the Koa example. Patch release so the corrected README reaches the npm package page.
