# Architecture

```mermaid
flowchart TD
  subgraph Browser
    P[Pages / client forms]
  end
  subgraph "Next.js 14 (App Router)"
    MW[middleware.ts<br/>session + role-area check]
    L[Area layouts<br/>server-side role guard]
    SC[Server components<br/>read data via repos]
    SA[Server actions<br/>Zod + authorization]
    RT[Route handlers<br/>/api/export/complaints<br/>/api/uploads/:name]
  end
  subgraph "Domain (src/lib, pure)"
    ST[STATUS_TRANSITIONS]
    PM[permissions.ts]
    SL[sla.ts]
    CS[csv.ts]
    VL[validation.ts]
  end
  subgraph "Server (src/server)"
    RP[repo/* — SQL, state machine,<br/>notifications, audit, analytics]
    AU[auth.ts — bcrypt + JWT cookie]
    DB[(SQLite<br/>node:sqlite)]
    FS[(uploads/ on disk)]
  end
  P --> MW --> L --> SC
  P -- form actions --> SA
  P --> RT
  SC --> RP
  SA --> AU
  SA --> RP
  RT --> AU
  RT --> RP
  RP --> ST & PM & SL
  SA --> VL
  RT --> CS
  RP --> DB
  SA --> FS
  RT --> FS
```

## Complaint lifecycle

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED
  SUBMITTED --> UNDER_REVIEW
  SUBMITTED --> REJECTED: admin + reason
  UNDER_REVIEW --> ASSIGNED
  UNDER_REVIEW --> REJECTED: admin + reason
  ASSIGNED --> ACCEPTED: technician
  ASSIGNED --> UNDER_REVIEW: technician declines / admin reassigns
  ACCEPTED --> IN_PROGRESS
  IN_PROGRESS --> READY_FOR_VERIFICATION: notes (+photo)
  READY_FOR_VERIFICATION --> RESOLVED: student confirms
  READY_FOR_VERIFICATION --> IN_PROGRESS: student says not fixed
  RESOLVED --> CLOSED: admin
  RESOLVED --> REOPENED: student
  CLOSED --> REOPENED: student
  REOPENED --> ASSIGNED
  REOPENED --> UNDER_REVIEW
  note right of CLOSED: Admin override-close (reason recorded)\nis available from any non-final state
```

## Layers and responsibilities
* **Pages** are server components; interactive parts are small client components (`src/components/**`).
* **Actions** (`src/server/actions`) — the only mutation entry points: validate (Zod) → authorize → call repo → revalidate.
* **Repo** (`src/server/repo`) — SQL and business rules. `transitionComplaint()` enforces lifecycle + role/ownership,
  writes the activity log, audit log and notifications in one place.
* **Data**: `src/server/db/schema.sql` (runtime) mirrors `prisma/schema.prisma` (migration target).

## Swapping SQLite for PostgreSQL
Only `src/server/db/client.ts` and `src/server/repo/*` touch SQL. Replace them (e.g. with Prisma) and keep action/page code.
