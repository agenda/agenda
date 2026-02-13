# @agendajs/mongo-backend

## 3.1.1

### Patch Changes

- 75bb2ba: Add "default" export condition to all packages to support CommonJS require()

  The exports map only specified the "import" condition, which prevented CommonJS projects from using require() to load these packages. Node.js require() matches "require" or "default" conditions, not "import". With require(esm) now stable in Node.js 20.19+, 22.12+, and 24+, adding a "default" condition allows CJS projects to consume these ESM packages directly.

- Updated dependencies [75bb2ba]
  - agenda@6.2.2

## 3.1.0

### Minor Changes

- 045fe5e: CVE-2026-25128 by overriding fast-xml-parser to ^5.3.4 in root package.json

### Patch Changes

- Updated dependencies [fb05ddd]
  - agenda@6.2.1

## 3.0.1

### Patch Changes

- Security: Fix CVE-2026-25128 (fast-xml-parser RangeError DoS) via pnpm override to ^5.3.4

## 3.0.0

### Patch Changes

- Updated dependencies [758cb99]
- Updated dependencies [09e7b54]
  - agenda@6.2.0

## 2.0.0

### Patch Changes

- 304c764: flacky test
- Updated dependencies [c34ae31]
- Updated dependencies [9c6843e]
- Updated dependencies [605ba67]
  - agenda@6.1.0

## 1.0.0

### Minor Changes

- c23769b: Add job debouncing support to combine rapid job submissions into single execution

  Debouncing delays job execution and resets the timer on subsequent saves, ensuring the job only runs once after a quiet period. This is useful for scenarios like updating search indexes after rapid document changes, syncing user data after multiple updates, or rate-limiting notifications.

  Features:
  - New `.debounce(delay, options?)` method on Job class
  - Trailing strategy (default): execute after quiet period ends
  - Leading strategy: execute immediately, ignore subsequent calls during window
  - maxWait option: guarantee execution within maxWait even if saves keep coming
  - DB-backed implementation: survives process restarts and works across distributed instances
  - New `nowDebounced()` helper method on Agenda class

  Usage:

  ```typescript
  // Basic trailing debounce - execute 2s after last save
  await agenda
  	.create('updateSearchIndex', { entityType: 'products' })
  	.unique({ 'data.entityType': 'products' })
  	.debounce(2000)
  	.save();

  // With maxWait - guarantee execution within 30s
  await agenda
  	.create('syncUser', { userId: 123 })
  	.unique({ 'data.userId': 123 })
  	.debounce(5000, { maxWait: 30000 })
  	.save();

  // Leading strategy - execute immediately, ignore subsequent calls
  await agenda
  	.create('notify', { channel: '#alerts' })
  	.unique({ 'data.channel': '#alerts' })
  	.debounce(60000, { strategy: 'leading' })
  	.save();
  ```

### Patch Changes

- 457adf6: full agenda postgres test suite and fixes
- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- b4db892: Improve type safety in mongo-changestream tests
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- Updated dependencies [c23769b]
- Updated dependencies [5d53d72]
- Updated dependencies [7b262a6]
- Updated dependencies [457adf6]
- Updated dependencies [0f80e59]
- Updated dependencies [c946a23]
- Updated dependencies [4a3f8ed]
- Updated dependencies [b10bf2d]
- Updated dependencies [0aa54be]
- Updated dependencies [6420cdd]
- Updated dependencies [f8e62ee]
- Updated dependencies [bfbeb12]
- Updated dependencies [225a9f8]
- Updated dependencies [073e62d]
- Updated dependencies [e6b3354]
- Updated dependencies [fda16c1]
- Updated dependencies [ce647d2]
- Updated dependencies [94f7e9b]
- Updated dependencies [f8e62ee]
  - agenda@6.0.0

## 1.0.0-alpha.0

### Patch Changes

- 457adf6: full agenda postgres test suite and fixes
- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- Updated dependencies [7b262a6]
- Updated dependencies [457adf6]
- Updated dependencies [c946a23]
- Updated dependencies [4a3f8ed]
- Updated dependencies [f8e62ee]
- Updated dependencies [bfbeb12]
- Updated dependencies [225a9f8]
- Updated dependencies [073e62d]
- Updated dependencies [94f7e9b]
- Updated dependencies [f8e62ee]
  - agenda@6.0.0-alpha.0
