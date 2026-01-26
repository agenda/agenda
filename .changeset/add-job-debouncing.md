---
"agenda": minor
"@agendajs/mongo-backend": minor
"@agendajs/postgres-backend": minor
"@agendajs/redis-backend": minor
---

Add job debouncing support to combine rapid job submissions into single execution

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
await agenda.create('updateSearchIndex', { entityType: 'products' })
  .unique({ 'data.entityType': 'products' })
  .debounce(2000)
  .save();

// With maxWait - guarantee execution within 30s
await agenda.create('syncUser', { userId: 123 })
  .unique({ 'data.userId': 123 })
  .debounce(5000, { maxWait: 30000 })
  .save();

// Leading strategy - execute immediately, ignore subsequent calls
await agenda.create('notify', { channel: '#alerts' })
  .unique({ 'data.channel': '#alerts' })
  .debounce(60000, { strategy: 'leading' })
  .save();
```
