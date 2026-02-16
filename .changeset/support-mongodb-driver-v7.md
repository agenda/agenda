---
"@agendajs/mongo-backend": minor
---

Move `mongodb` from `dependencies` to `peerDependencies` (`^6.0.0 || ^7.0.0`) to support MongoDB Node.js driver v7. This fixes the `BSONVersionError: Unsupported BSON version` error when users have `mongodb@^7.0.0` in their project.
