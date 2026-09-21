# Maintenance Request Log (MRL)

Internal maintenance request log for **PT. Hirose Electric Indonesia**.

> **STATUS: planning stage.** This README is a skeleton that lays out the final structure.
> It will be fully populated as the implementation lands. Planning documents live in [`docs/`](docs/).

---

## Quick Start

```bash
git clone <repo-url>
cd maintenance-request-log
cp .env.example .env          # the only manual step
docker compose up --build
```

Open **http://localhost:8080**.

### Seeded Credentials

| Username | Password        | Role       |
| -------- | --------------- | ---------- |
| `bud`    | `operator123`   | Operator   |
| `siti`   | `supervisor123` | Supervisor |
| `andi`   | `admin123`      | Admin      |

> Demo credentials only. Never use these outside local development.

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

<!-- to fill in: diagram + key decisions summary, link to docs/02-architecture.md -->

### Key Decisions

- **JWT in an httpOnly cookie** — stateless, unreadable from JS (XSS-safe), same-origin via nginx so no CORS and `SameSite=Lax` applies. See [docs/02](docs/02-architecture.md#adr-01--auth-jwt-di-httponly-cookie).
- **Authorization is layered** — `authMiddleware` → `requireRole()` → per-resource policy. The permission matrix cannot be enforced by middleware alone; ownership and status are checked in the service layer.
- **The UI is not the security boundary** — every rule is enforced by the API and testable with curl.

---

## Permission Matrix

<!-- to fill in: mirror docs/01-requirements.md section 2 -->

Full matrix: [docs/01-requirements.md](docs/01-requirements.md#2-matriks-izin-sumber-kebenaran)

---

## Jenkinsfile Stages

<!-- to fill in: mirror docs/06-infrastructure.md section 6 -->

| Stage              | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Checkout           | Fetch source with full commit history                            |
| Install            | Deterministic `npm ci` for `api` and `web`                       |
| Lint               | Style check; fail fast and cheap                                 |
| Type Check         | `tsc --noEmit` on both packages                                  |
| Tests              | Permission matrix + service tests                                |
| Build              | `docker compose build` to validate Dockerfiles                   |
| Start & Smoke Test | `compose up -d`, wait for `/health`, hit the API, then tear down |
| post               | Always `docker compose down -v`                                  |

---

## Optional Tasks Attempted

<!-- to fill in: mirror docs/07-optional-tasks-plan.md section 12 -->

Planned to be implemented: **audit trail**, **pagination + server-side search**.
Planned only: OpenAPI, time-series (downtime), MQTT ingest.
Partial: health check, permission-matrix tests, multi-stage Dockerfile.

---

## Known Limitations

<!-- to fill in -->

- Attachment upload is not implemented (the dropzone in the UI reference is treated as a placeholder).
- No email or push notifications.
- Pagination uses `LIMIT/OFFSET`.

---

## AI Disclosure

<!-- to fill in — required by the brief -->

To be completed: which tools were used and for which parts, why AI was used for those and not
others, and at least one case where the tool's output was **rejected or rewritten**. One concrete
example already recorded in planning: the `ui-ux-pro-max` design-system search proposed a _dark OLED
theme with green accents and a serif typeface_, which was rejected because it conflicts with the
fixed Hirose brand identity (Hirose blue, light corporate enterprise UI).

---

## Project Structure

```text
.
├── docker-compose.yml
├── Jenkinsfile
├── .env.example
├── docs/          # planning & design decisions
├── api/           # Hono backend
├── web/           # Vue 3 frontend
└── scripts/       # smoke test & helpers
```
