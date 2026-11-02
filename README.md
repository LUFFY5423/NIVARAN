# Nivaran — evidence-based student housing maintenance & grievance platform

Nivaran lets students report hostel/campus problems, and lets administrators and technicians assign, track,
resolve, verify and analyse them. Every complaint has a timestamped activity timeline, an SLA deadline with
overdue escalation, before/after photo evidence, and a **student verification step** — a complaint is not
closed silently.

> **All data is fictional.** Names, emails, hostels and complaints come from a seed script for demonstration.

## Main features

| Area | What works |
| --- | --- |
| Auth & RBAC | Register/login (bcrypt), signed JWT cookie sessions re-validated against the DB each request, 3 roles, middleware **and** server-side layout guards, per-action authorization |
| Student | Dashboard, submit complaint (category, block/room, priority, photo), my complaints + filters, complaint detail, comments, confirm resolution, "not fixed"/reopen, rating, notifications |
| Admin | Dashboard (KPIs + 5 charts), all complaints with 8 filters, assign/reassign, change priority, reject (reason required), close, **override-close (reason recorded)**, users, hostels/blocks/rooms/departments, categories + SLA hours, analytics, audit log, **CSV export**, **Run SLA Check** |
| Technician | Dashboard (active/urgent/overdue/completed/recent), assigned list, accept/decline, start work, work notes + resolution photo, mark ready for verification, availability toggle |
| Accountability | Activity timeline (user, previous → new status, time, comment), audit log, SLA countdown/overdue badges, auto-escalation, before/after evidence, anonymized public stats page (`/public-stats`) |
| Notifications | In-app for: submitted, assigned, status change, comment, nearing SLA, overdue, ready for verification, reopened. `createNotification()` is the single seam where an email sink can be added |

Lifecycle: `Submitted → Under Review → Assigned → Accepted → In Progress → Ready for Verification → Resolved → Closed`,
plus `Reopened` (from Resolved/Closed) and `Rejected` (admin only, reason required). The state machine lives in
`src/lib/types.ts` (`STATUS_TRANSITIONS`) and role rules in `src/lib/permissions.ts`; both are enforced in the
repository layer, so no code path can bypass them.

## Demo accounts

Password for **all** accounts: `Password123!` (also shown on `/login` and `/about`)

| Role | Email |
| --- | --- |
| Administrator | admin@nivaran.edu |
| Technician (Electrical) | ramesh.tech@nivaran.edu |
| Technician (Plumbing) | sunita.tech@nivaran.edu |
| Students | aarav.student@ · diya.student@ · kabir.student@ · anika.student@ · vihaan.student@ `nivaran.edu` |

## Quick start

Requires **Node.js ≥ 18.18** and **PostgreSQL ≥ 13** (the schema uses native enums and the `citext` extension).

```bash
docker compose up -d db       # local Postgres 16 (creates `nivaran` and `nivaran_test`) — or use your own server
```
Without Docker: `createdb nivaran && createdb nivaran_test` and adjust `DATABASE_URL` in `.env`.


```bash
npm install
cp .env.example .env          # then set AUTH_SECRET:  openssl rand -base64 32
npm run setup                 # creates tables/enums in Postgres and loads demo data
npm run dev                   # http://localhost:3000
```

Useful commands

| Command | Purpose |
| --- | --- |
| `npm run db:migrate` | Apply `src/server/db/schema.sql` (idempotent) |
| `npm run db:seed` | Wipe and reload demo data (17 complaints in every status) |
| `npm run db:reset` | Drop all tables/types, migrate, seed |
| `npm test` | Vitest suite (44 tests) |
| `npm run e2e` | Playwright browser test (needs `npx playwright install chromium` first) |
| `npm run verify` | format check + lint + typecheck + tests + production build |

### Troubleshooting: "Application error: a server-side exception has occurred" after logging in

This means the app could not use its database. Check, in order: (1) PostgreSQL is running; (2) `.env` exists and `DATABASE_URL`
points at a database that exists (`createdb nivaran`) — an old SQLite `file:./dev.db` URL will not work; (3) you ran
`npm run setup` so tables and demo users exist; (4) restart `npm run dev` after editing `.env`. The login form now shows
this hint instead of a crash page.

## Environment variables (`.env.example`)

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql://nivaran:nivaran@localhost:5432/nivaran` |
| `TEST_DATABASE_URL` | Optional; database used by `npm test` (**truncated between tests** — never point at real data) |
| `AUTH_SECRET` | ≥16 chars; signs session tokens. **Never commit a real value** (`.env` is git-ignored) |
| `SESSION_COOKIE_NAME` | Optional cookie name |
| `MAX_UPLOAD_BYTES` | Max attachment size (default 5 MB; use ≤ 4000000 on Vercel) |

## Architecture (short)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the diagram. Next.js App Router (server components read data
directly; mutations are server actions) → `src/server/actions` (validate with Zod, authorize, call repos) →
`src/server/repo` (parameterized SQL via `pg`, state machine, notifications, audit) → PostgreSQL. Pure logic (SLA, CSV, permissions,
validation) lives in `src/lib` so it is unit-testable without a database.

Also: [docs/PRD.md](docs/PRD.md) (requirements) · [docs/API.md](docs/API.md) (actions & routes) ·
`prisma/schema.prisma` (reference data model, not used at runtime).

## Technology choices

Next.js 14 + TypeScript + Tailwind (cream/kelly-green design system, self-hosted Fredoka + Inter fonts); PostgreSQL via `pg`; hand-rolled accessible UI primitives (shadcn-style, no CLI dependency);
Zod; Recharts; lucide-react; `jose` + `bcryptjs` for sessions/passwords; Vitest; Playwright.

## Security notes

Passwords hashed with bcrypt · httpOnly, SameSite=Lax session cookie · sessions re-checked against the DB (deactivation is
immediate) · role guards in middleware, area layouts, and every server action · students/technicians can only read
complaints they own/are assigned to (others get a 404, so ids can't be probed) · uploads: MIME allow-list, size limit,
extension derived from MIME, stored in PostgreSQL (not on public disk), served only after an access check · generic login errors ·
CSV export neutralizes spreadsheet formula injection · Zod validation on every form · Next.js server actions provide
built-in Origin checking against CSRF.

## Testing status (honest summary)

* **Vitest — 44 tests, all passing against a real PostgreSQL 16 database**: password hashing, session tokens, login/register actions (incl. no role
  escalation, generic errors, deactivation), complaint creation, assignment, every transition + illegal ones, role/ownership
  enforcement, reopen, SLA overdue/nearing/escalation, CSV route (401/403/filtering/escaping), unauthorized access,
  uploads, ratings, public-stats anonymity, and a **full server-action workflow** (submit with photo → assign → accept →
  work → resolution photo → verify → rate → reopen).
* **HTTP smoke test** against the production build with signed cookies for each role: all pages 200 for the right role,
  redirects for wrong role/anonymous, 404 for others' complaints/images, CSV 401/403/200.
* **Playwright spec is written (`e2e/`) but was NOT executed** where this was built (browser download blocked). Run it
  locally with `npx playwright install chromium && npm run e2e`.
* The redesigned UI was **not viewed in a real browser** during authoring (no browser available for visual review); responsive layout and keyboard flow are built
  with standard accessible patterns (labels, focus rings, `role="status"`, `aria` on switches) but should get a manual pass.

## Deployment notes

`npm run build && npm start` on any Node ≥ 18.18 host with a reachable PostgreSQL (run `npm run db:migrate` once). Photos are stored in the database, so no persistent disk is needed. Set a strong
`AUTH_SECRET` and `NODE_ENV=production` (enables `Secure` cookies; serve over HTTPS). Single-instance only (see limitations).
Hosting on Vercel + Neon is supported (see below). For heavy use, move photos to object storage.

### Free hosting: Vercel + Neon

1. Create a free Neon project and copy its **pooled** connection string (host contains `-pooler`).
2. Load the schema and demo data once from your laptop: `DATABASE_URL="<neon url>" npm run setup`.
3. Push the repo to GitHub, import it at vercel.com (framework: Next.js, defaults are fine).
4. Add environment variables in Vercel: `DATABASE_URL` (Neon URL), `AUTH_SECRET` (`openssl rand -base64 32`),
   `MAX_UPLOAD_BYTES=4000000`. Deploy.

Not verified here: I could not deploy to Vercel from the build sandbox; the app was tested as a production build against PostgreSQL.

## Known limitations

1. **Prisma is not used at runtime.** Prisma's engine binaries could not be downloaded in the build sandbox, so persistence uses
   PostgreSQL through `pg` with a small repository layer (`src/server/repo`) and `src/server/db/schema.sql` (native enums, CITEXT
   email, TIMESTAMPTZ). `prisma/schema.prisma` mirrors the model if you later want Prisma: run `prisma generate` where engines can
   be fetched and re-implement `src/server/repo/*` — call sites only use repo functions.
2. **Migrations** are a single idempotent `schema.sql` (no versioned migration history); fine for a prototype, adopt a migration tool before production changes.
3. SLA escalation is an admin **"Run SLA Check"** button, not a scheduler. For automation, call `runSlaCheck()` from cron
   (a system actor id is required for the audit trail).
4. No login rate limiting / lockout, password reset, or email verification.
5. Attachments are stored in PostgreSQL (fine for a demo; use object storage at scale); no virus scanning; images only.
6. SLA hours apply to complaints created after a change; the admin can't edit the SLA deadline of a single complaint.
7. Notifications don't auto-push (refresh/navigation shows them); no email yet.
8. "Complaint details and assignment" and "work-detail" pages are one shared route (`/complaints/[id]`) that renders
   role-specific panels, rather than separate pages per role.
9. UI kit is hand-built shadcn-style components, not the shadcn CLI package.
10. Categories/departments/locations can be added but not edited or deleted from the UI.

## Future improvements

Email/SMS sinks, scheduled SLA job, versioned migrations, object storage, login throttling & 2FA, SLA pause states,
per-complaint deadline edits, technician skill-based auto-assignment, duplicate-complaint detection, mobile PWA push.
