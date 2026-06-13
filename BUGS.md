# Bug fixes and a security hardening

Five bugs in the TypeScript packages, each with a fix and a regression test, plus one
security hardening for the Mongo backend. Four of the bugs are in shipped code; one is
in the reference fork worker that users copy.

Test results after the changes:

- agenda: 177 pass
- mongo-backend: 250 pass, 3 skipped
- postgres-backend: typecheck passes; the injection test runs without a database
- lint: clean

None of this code exists in the original `agenda/agenda` (JS) repo, so none of it is in
that project's issue tracker.

## Where the Postgres injection can lead

Apps often build `unique()` constraint keys from request data, e.g. "one job per user".
Bug #5 lets an attacker put SQL into that key, which changes the upsert's lookup so it
matches a different job. The matching `UPDATE` has no `LIMIT`, so it can overwrite other
jobs' `data` and `next_run_at` and force them to run immediately. If a target job's
handler uses `data` to run a command, build a path, or make a request, that turns into
code execution, SSRF, or path traversal in the application. Fixing #5 keeps the lookup
from matching anything the caller did not intend.

Bugs #2 and #3 make this worse in practice: a recurring cleanup or alerting job that
would catch the tampering may never run (#2) or stop retrying after one recovery (#3).

## Bug #1: queue runs the highest-priority job last

File: `packages/agenda/src/JobProcessingQueue.ts`

The queue is read from the end of the array (`returnNextConcurrencyFreeJob` scans it in
reverse). `insert()` put a job that should run before everything else (highest
priority, or earliest `nextRunAt`) at the front with `unshift`, which is the slot that
runs last. For jobs queued in the same tick, priority order comes out reversed.

Fix: push to the end instead.

```js
if (matchIndex === -1) {
    this._queue.push(job);
} else {
    this._queue.splice(matchIndex, 0, job);
}
```

Test: insert jobs in both orders and check the higher-priority and earlier job comes
out first.

## Bug #2: @Every jobs never scheduled when registerJobs runs after start

File: `packages/agenda/src/decorators/register.ts`

`@Every` jobs were scheduled from a `once('ready')` listener. Agenda emits `ready` once,
in the constructor. Code that does `await agenda.ready` before calling `registerJobs`
attaches the listener after the event already fired, so the jobs are never scheduled and
nothing throws. The code's own comment says it should "schedule immediately if agenda is
already started", which `once('ready')` cannot do.

Fix: use the `ready` promise, which stays resolved after the event.

```js
agenda.ready.then(() => scheduleJobs()).catch(err => agenda.emit('error', err));
```

Test: await `agenda.ready`, register, and check the job was saved.

## Bug #3: backoff failCount never resets, so a recovered job stops retrying

File: `packages/agenda/src/Job.ts`

`fail()` increments `failCount`, and `handleRetry()` uses it as the attempt number. A
successful run never reset it. A recurring job that exhausts its retries once and then
succeeds keeps the old count, so its next failure is treated as already out of retries
and gets no backoff.

Fix: reset `failCount` on success.

```js
if (this.attrs.failCount) {
    this.attrs.failCount = 0;
}
```

`0` persists cleanly and loads back as `undefined`, so a job that never failed is
unaffected.

Test: exhaust retries, run one success, fail again, and check a new retry is scheduled.

## Bug #4: fork mode broken on Windows (reference worker)

File: `packages/mongo-backend/test/helpers/forkHelper.ts`

This is in the reference fork worker that users copy, not in shipped code. The worker
imports the job definition by absolute path. On Windows that is `C:\...`, which dynamic
`import()` rejects with `ERR_UNSUPPORTED_ESM_URL_SCHEME`, so every forked job fails.

Fix: convert the path to a file URL.

```js
import { pathToFileURL } from 'node:url';
const loadDefinition = await import(pathToFileURL(agendaDefinition).href);
```

This is a no-op on POSIX.

Test: the fork mode tests in `mongo-backend.test.ts` (run on Windows here).

## Bug #5: SQL injection via unique() keys (Postgres)

File: `packages/postgres-backend/src/PostgresJobRepository.ts`

The unique-constraint lookup bound the values but put the keys straight into the SQL:

```js
conditions.push(`data->>'${dataPath}' = $${paramIndex++}`);  // JSON path key
conditions.push(`${columnName} = $${paramIndex++}`);          // column name
```

A key like `data.id' OR '1'='1` rewrites the `WHERE` clause of the existence check that
drives the upsert. The matching `UPDATE` has no `LIMIT`, so it can overwrite every job's
`data` and `next_run_at`.

Fix: bind the JSON path as a parameter, and check the column name against the table's
columns, since identifiers cannot be bound.

```js
if (key.startsWith('data.')) {
    conditions.push(`data->>$${paramIndex++} = $${paramIndex++}`);
    params.push(key.slice(5), String(value));
} else {
    const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (!UNIQUE_QUERYABLE_COLUMNS.has(columnName)) {
        throw new Error(`Invalid unique constraint field: "${key}"`);
    }
    conditions.push(`"${columnName}" = $${paramIndex++}`);
    params.push(value);
}
```

The JSON path adds a parameter, so `paramIndex` advances by two to keep the later
`UPDATE` placeholders lined up.

Test: a mock pool checks the payload is bound rather than present in the SQL text, and
that unknown columns are rejected.

## Security hardening (suggestion): reject unsafe operators in Mongo unique()

File: `packages/mongo-backend/src/MongoJobRepository.ts`

This is not a library bug. MongoDB queries are objects, and `unique()` is documented to
take a query filter, so the backend passes it through as designed. But if an app builds
`unique` keys from untrusted input, the same risk as the Postgres case applies:
`$where`, `$function`, `$expr`, and `$accumulator` run server-side code, and `$ne`,
`$regex`, and `$gt` make the lookup match a different job. The data query path is already
safe because it flattens operators into literal keys, but `unique` is not flattened.

Since the code-evaluation operators have no use in a uniqueness key, the backend now
rejects them before building the query. Equality and comparison constraints are
unchanged.

```js
const BANNED = new Set(['$where', '$function', '$accumulator', '$expr']);

function assertSafeUniqueQuery(value) {
    if (Array.isArray(value)) {
        for (const item of value) assertSafeUniqueQuery(item);
        return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
        if (BANNED.has(key)) {
            throw new Error(`Unsafe operator "${key}" is not allowed in a unique() constraint`);
        }
        assertSafeUniqueQuery(child);
    }
}
```

`isPlainObject` keeps the walk from descending into `ObjectId`, `Date`, or `Buffer`
values.

Test: unit tests for the check, plus an integration test that saves a `$where`
constraint (rejected) and a normal constraint (accepted) against a real MongoDB.
