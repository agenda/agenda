# @agendajs/redis-backend

## 3.0.0

### Patch Changes

- Updated dependencies [758cb99]
- Updated dependencies [09e7b54]
  - agenda@6.2.0

## 2.0.0

### Patch Changes

- 605ba67: bi-directional state notificatoins
- Updated dependencies [c34ae31]
- Updated dependencies [9c6843e]
- Updated dependencies [605ba67]
  - agenda@6.1.0

## 1.0.0

### Major Changes

- bfbeb12: Add Redis backend implementation for Agenda job scheduler

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

- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- 2b65f9d: feat: add Redis backend full test suite and improve backend API consistency
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

### Major Changes

- bfbeb12: Add Redis backend implementation for Agenda job scheduler

### Patch Changes

- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- 2b65f9d: feat: add Redis backend full test suite and improve backend API consistency
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
