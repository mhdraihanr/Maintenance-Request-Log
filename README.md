# Maintenance Request Log (MRL)

Internal maintenance request log for **PT. Hirose Electric Indonesia**.

Operators raise a request when a machine has a problem, Supervisors approve or reject it,
and Admins manage users and records.

---

## Quick Start

```bash
git clone <repo-url>
cd maintenance-request-log
cp .env.example .env          # the only manual step
docker compose up --build
```

Open **http://localhost:8080**.

Migrations and seed run automatically inside the API container on start, so a clean clone
comes up with tables, indexes, and demo data already in place.

### Seeded Credentials

| Username | Password        | Role       |
| -------- | --------------- | ---------- |
| `bud`    | `operator123`   | Operator   |
| `siti`   | `supervisor123` | Supervisor |
| `andi`   | `admin123`      | Admin      |

> Demo credentials only. Never use these outside local development.

### Running Locally Without Docker

Requires Node 20+ and a reachable PostgreSQL 16.

```bash
# API — http://localhost:3000
cd api
npm ci
npm run migrate
npm run seed
npm run dev

# Web — http://localhost:5173 (proxies /api to localhost:3000)
cd web
npm ci
npm run dev
```

---

## Tech Stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Vue 3 + Vite + TypeScript (Pinia, Vue Router)              |
| Backend    | Hono (TypeScript) on Node 20                               |
| Database   | PostgreSQL 16                                              |
| Auth       | JWT (HS256) in an httpOnly cookie                          |
| Passwords  | argon2id                                                   |
| Validation | Zod                                                        |
| Container  | Docker Compose (nginx serves the SPA and proxies `/api/*`) |

---

## Architecture

The SPA and the API share one origin: nginx serves the static build and proxies `/api/*`
to the API container. That removes CORS entirely and lets `SameSite=Lax` cookies work
without extra configuration.

```
browser ──> nginx :80 ──┬──> static SPA build
                        └──> /api/* ──> Hono (Node) :3000 ──> PostgreSQL 16
```

The backend is layered so each concern has one home:

```
routes/       HTTP shape, request/response only
schemas/      Zod validation — the input contract
policies/     authorization rules (the permission matrix)
services/     business logic + SQL
middleware/   requestId, logger, error handler, auth, role guard
```

### Key Decisions

Full rationale: [docs/02-architecture.md](docs/02-architecture.md).

- **JWT in an httpOnly cookie** — stateless, unreadable from JS (XSS-safe), sent
  automatically. Because the token cannot be revoked early, `is_active` is re-checked
  against the database on every request.
- **Authorization is layered** — `authMiddleware` (who are you?) → `requireRole()`
  (may this role enter?) → **per-resource policy** (may _this user_ touch _this row_?).
  The permission matrix cannot be enforced by middleware alone: `PATCH /requests/:id`
  admits Operator, Supervisor, and Admin, but the first two only for their own request
  while it is still `submitted`. That check needs the row, so it lives in the service layer.
- **One shared policy function per action** — the allow path and the deny path call the
  same `canEdit` / `canReview` / `canDelete`. There is no duplicated rule that can drift.
- **Raw SQL over an ORM** — two tables; every query stays readable in review.
  Parameterized queries (`$1, $2`) prevent injection.
- **A uniform response envelope** — success is always `{ "data": ... }`, errors are
  always `{ "error": { "code", "message", "fields"? } }`. The frontend has one error
  handler, and curl-based testing stays predictable.
- **The UI is not the security boundary** — the navigation hides what a role cannot use,
  but every endpoint re-checks authorization. This is provable with curl, and pinned by
  the permission-matrix test suite.

---

## Permission Matrix

Full matrix and edge cases: [docs/01-requirements.md](docs/01-requirements.md#2-matriks-izin-sumber-kebenaran).

Legend: ✅ allowed · ❌ denied · 👤 own records only.

| #   | Action                                | Operator | Supervisor | Admin |
| --- | ------------------------------------- | :------: | :--------: | :---: |
| 1   | Create request                        |    ✅    |     ✅     |  ✅   |
| 2   | View own request                      |    ✅    |     ✅     |  ✅   |
| 3   | View all requests                     |    ❌    |     ✅     |  ✅   |
| 4   | Edit own request (status `submitted`) |   ✅👤   |    ✅👤    |  ✅   |
| 5   | Edit any request                      |    ❌    |     ❌     |  ✅   |
| 6   | Approve / Reject                      |    ❌    |     ✅     |  ✅   |
| 7   | Delete request                        |    ❌    |     ❌     |  ✅   |
| 8   | Manage users (create/edit/deactivate) |    ❌    |     ❌     |  ✅   |

Edge cases resolved deliberately:

- An Admin may re-review an already-reviewed request (overwrite); a Supervisor gets
  `409 Conflict` instead — this prevents two supervisors clobbering each other.
- An Operator cannot edit their own request once it leaves `submitted`.
- `created_by`, `status`, `created_at`, `reviewed_by`, `reviewed_at` can never be set
  through the create/update payloads.

---

## API Overview

Full spec with request/response examples: [docs/04-api-spec.md](docs/04-api-spec.md).

| Method | Path                        | Who                         |
| ------ | --------------------------- | --------------------------- |
| POST   | `/api/auth/login`           | anyone (rate-limited)       |
| POST   | `/api/auth/logout`          | authenticated               |
| GET    | `/api/auth/me`              | authenticated               |
| GET    | `/api/requests`             | scoped by role              |
| POST   | `/api/requests`             | operator, supervisor, admin |
| GET    | `/api/requests/:id`         | per-row policy              |
| PATCH  | `/api/requests/:id`         | per-row policy              |
| POST   | `/api/requests/:id/approve` | supervisor, admin           |
| POST   | `/api/requests/:id/reject`  | supervisor, admin           |
| DELETE | `/api/requests/:id`         | admin                       |
| GET    | `/api/users`                | admin                       |
| POST   | `/api/users`                | admin                       |
| PATCH  | `/api/users/:id`            | admin                       |
| DELETE | `/api/users/:id`            | admin                       |

List endpoints return a page envelope: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.
`GET /api/requests` accepts `status`, `priority`, `search`, `sort`, `order`, `page`, `limit`.
The `sort` column is whitelisted server-side.

---

## Jenkinsfile Stages

`Jenkinsfile` lives at the repository root. It is **not** run against a live Jenkins server;
the stages are meant to be read, and every command in it has been executed by hand against
this repository. Rationale and measured results: [docs/06-infrastructure.md](docs/06-infrastructure.md#6-jenkinsfile).

| Stage                    | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| Checkout                 | Fetch the source with full commit history (not depth 1)                   |
| Prepare Env              | Create `.env` from `.env.example` with a random `JWT_SECRET`              |
| Install                  | Deterministic `npm ci` for `api` and `web`                                |
| Type Check               | `tsc --noEmit` / `vue-tsc --noEmit` on both packages                      |
| Test                     | `npm run verify` — the permission matrix and other suites, no DB needed   |
| Build                    | `docker compose build`, validating both Dockerfiles and the build context |
| Start Stack & Smoke Test | `compose up -d --wait`, then an end-to-end smoke test, then tear down     |
| post                     | Always `docker compose down -v` so the next run starts from a clean DB    |

Two deliberate design points:

- **`Test` and `Smoke Test` are separate stages.** `Test` checks unit-level rules without a
  database; `Smoke Test` proves the real integration (DB + migrations + seed + auth) works.
  A failure in one points at a different area than a failure in the other.
- **The smoke test checks `/health` from inside the API container.** `/health` is registered
  at the API root, while nginx only proxies the `/api/` prefix, so the endpoint is not
  reachable from outside and the SPA fallback would answer `200` with HTML for it. Checking
  it in-network also exercises the real API → database connection.

There is intentionally no `Lint` stage: the repository does not ship an ESLint/Prettier
configuration, so such a stage would call a script that does not exist.

Run the same checks locally:

```bash
cd api && npm run verify      # type check + every test suite
cd web && npm run typecheck && npm run build
docker compose build
docker compose up -d --wait && sh scripts/smoke-test.sh && docker compose down -v
```

---

## Optional Tasks Attempted

- **Health check endpoint and structured logging** — `GET /health` reports live database
  status and is wired into the Compose `healthcheck` for the API service. The logger emits
  one structured JSON line per request with `requestId`, `method`, `path`, `status`,
  `elapsedMs`, and `userId`.
- **Meaningful automated tests** — fifteen suites covering the permission matrix, middleware,
  Zod schemas, services, and routes. Services and routes are exercised through dependency
  injection, so the suites need no live database and stay fast enough to run in CI.
  Run them with `cd api && npm run verify`.
- **Pagination and server-side search** — `GET /api/requests` supports `page`, `limit`,
  `search` (over `machine_id` and `description`), and `sort`/`order` on a server-side
  whitelist of columns. The list page drives all of it from the UI.
- **Multi-stage Dockerfile** — both images are multi-stage. Measured with `docker images`:
  API **214 MB**, web **98.6 MB**. The web image is a single nginx stage serving only the
  built assets; the API image runs the compiled `dist/` with production dependencies only.
- **Rate-limited login** — five attempts per 15 minutes per IP + username, returning
  `429 RATE_LIMITED`.

---

## Known Limitations

- **No audit trail.** A request keeps only the latest `reviewed_by` / `reviewed_at`.
  The timeline on the detail page is reconstructed from `createdAt` and the current
  review fields, not from an append-only history table.
- **No aggregate endpoint.** The dashboard computes its counts client-side from the first
  100 requests returned by the list endpoint. Fine for the seeded dataset; a real deployment
  would want a dedicated `GET /api/requests/stats`.
- **Search is not index-optimized.** `ILIKE '%…%'` runs as a sequential scan. `pg_trgm`
  with a GIN index would be the next step for a few thousand rows.
- **Attachment upload is not implemented.** The dropzone in the UI reference is treated
  as a placeholder.
- **No email or push notifications.**
- **Pagination uses `LIMIT/OFFSET`** — acceptable at this scale, but a cursor would be
  needed for deep pages over a large table.
- **The JWT cannot be revoked before its 8-hour TTL** other than by deactivating the user,
  which is re-checked on every request.

---

## AI Disclosure

I used **GitHub Copilot** (chat and inline completion) as the main assistant, with
**Exa** for researching library behaviour and **Context7** for up-to-date API references.
It helped most in the mechanical, well-specified parts: scaffolding the Hono routes,
the Zod schemas, the Vue components, and the first draft of the SQL in the services.
I wrote by hand the parts where the design _is_ the answer — the permission matrix and
its policy functions, the layered authorization (ADR-04), the error envelope, and the
database schema and constraints — because those carry the judgement the brief is asking
for, and I wanted to be able to defend every branch of them in the interview.

AI was a poor fit for anything that had to be **verified against reality**. One concrete
case I rejected: a design-system search proposed a _dark OLED theme with green accents and
a serif typeface_. I threw it out because it conflicts with the fixed Hirose brand identity
— this is a light, corporate enterprise UI, and the brief pins that reference. Similarly,
a first-draft Jenkinsfile the tool produced called `npm run lint` and `npm test`, neither of
which exists in this repo; I replaced them with the real `typecheck` and `verify` scripts.

The pattern throughout: let the assistant produce the first pass for the parts I could
check quickly, then prove each piece by running it. Several of those runs changed the code —
five frontend bugs surfaced only in a real browser session, and the `reviewedBy` field was
returning a raw UUID until I exercised the endpoint and saw it. What AI produced was a draft;
what shipped was what survived being executed.

---

## Project Structure

```text
.
├── docker-compose.yml
├── Jenkinsfile
├── .env.example
├── docs/          # planning, requirements, architecture, API spec
├── api/           # Hono backend
│   ├── db/migrations/
│   ├── src/       # routes, schemas, policies, services, middleware
│   └── tests/     # permission matrix and other suites
├── web/           # Vue 3 frontend
│   └── src/       # api, components, composables, pages, policies, stores
└── scripts/
    └── smoke-test.sh
```
