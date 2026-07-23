---
'agenda': patch
---

Make `isValidDate` a true type guard by checking for a `Date` instance with a finite `getTime()`. Previously it accepted strings and other values that `new Date()` could parse, while narrowing them to `Date` at the type level, which could cause runtime errors when calling `Date` methods.
