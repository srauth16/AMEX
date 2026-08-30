# Feature Flag Manager

A small app for managing feature flags: **view** them, **turn them on or off**, and **create** new ones.

A feature flag is a named on/off switch for a product feature. Instead of shipping a change to everyone at once, you hide it behind a flag (for example `dark-mode`). Flip the flag on, users see it. Flip it off, they don’t.

## How to run

You need [Node.js](https://nodejs.org/) installed (v18 or newer is fine).

In this folder:

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

That command starts two processes:

| Piece | URL | What it is |
| --- | --- | --- |
| UI | http://localhost:5173 | The page you click around in |
| API | http://localhost:3001 | The server that stores flags |

The UI talks to `/api` on the same origin. Vite proxies those requests to the API, so you do not need to configure CORS in the browser.

Flags are saved in `data/flags.json`. The first request creates that file and seeds a few sample flags so the list is not empty.

### Other scripts

```bash
npm run build   # build the UI into dist/
npm start       # run only the API (serves dist/ if you have built)
```

## What you can do

- See all flags, with search
- Enable or disable a flag (saved immediately on the server)
- Create a flag with a name, key, optional description, and starting on/off state

Each flag has:

- **Name** — human-readable label (`Dark mode`)
- **Key** — stable id other code could look up (`dark-mode`)
- **Description** — what it controls
- **Enabled** — on or off

Keys must be unique, start with a letter, and use only lowercase letters, numbers, hyphens, or underscores.

## How it is put together

```
Browser (React + TypeScript)  →  GET/POST/PATCH /api/flags  →  Express server  →  data/flags.json
```

| Path | Role |
| --- | --- |
| `src/` | React UI (TypeScript) |
| `server/` | HTTP API (TypeScript, run with `tsx`) |
| `shared/types.ts` | Shared `FeatureFlag` types for UI and API |
| `data/flags.json` | Persistence (created at runtime) |

Type-check everything with `npm run typecheck`.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/flags` | List all flags |
| `POST` | `/api/flags` | Create a flag |
| `PATCH` | `/api/flags/:id` | Set `enabled` to `true` or `false` |

New integrations should use the versioned `/api/v1/flags` routes. The unversioned
routes remain as compatibility aliases. The versioned list endpoint returns
`{ data, pagination }` and accepts `q`, `limit` (maximum 100), and `offset`.

Operational endpoints:

| Path | Purpose |
| --- | --- |
| `/health/live` | Process liveness |
| `/health/ready` | Readiness for traffic |
| `/metrics` | Prometheus-compatible request counters |
| `/openapi.json` | OpenAPI 3.1 API contract |

Errors use a consistent `{ error: { code, message, requestId, details? } }`
shape. Every response also includes `x-request-id` for log correlation.

### Server configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API listen port |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |
| `JSON_BODY_LIMIT` | `32kb` | Maximum JSON request body |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Per-client rate-limit window |
| `RATE_LIMIT_MAX` | `120` | Requests allowed per window |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Forced-shutdown deadline |

Invalid numeric, environment, or origin configuration prevents startup. The
server emits structured JSON logs and drains active connections on SIGINT or
SIGTERM.

Example create body:

```json
{
  "name": "SMS alerts",
  "key": "sms-alerts",
  "description": "Send SMS for large charges",
  "enabled": false
}
```

Example toggle body:

```json
{ "enabled": true }
```

## Assumptions

- This is a local demo, not a production feature-flag service.
- One person using it at a time is enough (no login, no roles).
- Flags only need on/off — not percentage rollouts or per-user targeting.
- A JSON file is enough to persist data. No database.
- Sample flags on first run are useful so the UI is not empty.

## Tradeoffs

**JSON file instead of a database.** Easy to run with `npm install`. Concurrent writes from two people at the same moment could overwrite each other, and it will not scale.

**Separate UI and API.** Matches how most real apps work, and keeps the browser a client of a real HTTP API. The cost is two processes and a proxy during development.

**No authentication.** The assignment was view / toggle / create. Login would have dominated the work.

**No delete or rename.** Smaller, easier to follow. A typo in a key cannot be fixed in the UI today.

## If there were another day

- Tests for the API (create, duplicate key, invalid key, missing id) and a couple of UI flows
- Delete and edit, with “key cannot change after create”
- A public evaluate endpoint, e.g. `GET /api/flags/dark-mode` → `{ "enabled": true }`, so another app could consume flags
- SQLite (or similar) for safer concurrent writes
- An audit history of who toggled what, and when
- Environments (dev vs prod) and basic auth
- Percentage rollout / targeting
