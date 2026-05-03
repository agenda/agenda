# agenda-rest

REST API server for scheduling and managing [Agenda](https://github.com/agenda/agenda) jobs.

`agenda-rest` exposes a small Koa application with endpoints for defining jobs, scheduling one-off and recurring jobs, cancelling jobs, and checking service health. It can be run from the command line in this repository or mounted programmatically in another Node.js service.

## Requirements

- Node.js 18 or newer
- A MongoDB database for the CLI server
- An Agenda instance when using `createServer()` programmatically

## Running From This Repository

From the repository root:

```bash
pnpm install
pnpm --filter agenda-rest build
pnpm --filter agenda-rest start -- --uri mongodb://localhost:27017/agenda
```

The server listens on port `4040` by default and exposes all routes under `/api`.

### CLI Options

```bash
pnpm --filter agenda-rest start -- \
  --uri mongodb://localhost:27017/agenda \
  --collection agendaJobs \
  --port 4040 \
  --api-key secret-key
```

| Option | Default | Description |
| --- | --- | --- |
| `--uri` | `mongodb://localhost:27017/agenda` | MongoDB connection URI |
| `--collection` | `agendaJobs` | MongoDB collection used by Agenda |
| `--port` | `4040` | HTTP server port |
| `--api-key` | none | Enables `X-API-Key` authentication |
| `--timeout` | `5000` | Request timeout in milliseconds |

## Programmatic Usage

```ts
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { createServer } from 'agenda-rest';

const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://localhost:27017/agenda',
    collection: 'agendaJobs'
  })
});

await agenda.ready;
await agenda.start();

const app = createServer({
  agenda,
  apiKey: 'secret-key'
});

app.listen(4040, () => {
  console.log('agenda-rest listening on http://localhost:4040');
});
```

## Authentication

When `apiKey` is configured, protected endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: secret-key" http://localhost:4040/api/job
```

The health check endpoint does not require authentication.

## Endpoints

### `GET /api/health`

Returns service health.

```json
{
  "status": "ok"
}
```

### `GET /api/job`

Lists in-memory job definitions created through the REST API.

```bash
curl -H "X-API-Key: secret-key" http://localhost:4040/api/job
```

### `POST /api/job`

Creates a job definition. If `url` is provided, the job executes that webhook when it runs.

```bash
curl -X POST http://localhost:4040/api/job \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "name": "send-report",
    "url": "https://example.com/jobs/send-report",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token"
    },
    "body": {
      "report": "daily"
    }
  }'
```

### `PUT /api/job/:jobName`

Updates an existing job definition.

```bash
curl -X PUT http://localhost:4040/api/job/send-report \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "url": "https://example.com/jobs/send-daily-report"
  }'
```

### `DELETE /api/job/:jobName`

Deletes a job definition and cancels scheduled instances with the same job name.

```bash
curl -X DELETE \
  -H "X-API-Key: secret-key" \
  http://localhost:4040/api/job/send-report
```

### `POST /api/job/now`

Schedules a job to run immediately.

```bash
curl -X POST http://localhost:4040/api/job/now \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "name": "send-report",
    "data": {
      "report": "daily"
    }
  }'
```

### `POST /api/job/once`

Schedules a job to run once at a specific time.

```bash
curl -X POST http://localhost:4040/api/job/once \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "name": "send-report",
    "when": "in 1 hour",
    "data": {
      "report": "daily"
    }
  }'
```

### `POST /api/job/every`

Schedules a recurring job.

```bash
curl -X POST http://localhost:4040/api/job/every \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "name": "send-report",
    "interval": "5 minutes",
    "data": {
      "report": "daily"
    }
  }'
```

### `POST /api/job/cancel`

Cancels jobs matching a job name or data filter.

```bash
curl -X POST http://localhost:4040/api/job/cancel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-key" \
  -d '{
    "name": "send-report"
  }'
```

## Development

Run the package test suite:

```bash
pnpm --filter agenda-rest test
```

Build the package:

```bash
pnpm --filter agenda-rest build
```
