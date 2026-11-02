-- Nivaran PostgreSQL schema
-- This is the actual runtime schema, applied by `npm run db:migrate`.
-- prisma/schema.prisma documents the same model for teams that want to adopt
-- the Prisma Client directly (see README "Database" section for why this
-- build uses `pg` + hand-written SQL instead of Prisma Client at runtime).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE role_t AS ENUM ('STUDENT', 'ADMIN', 'TECHNICIAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority_t AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status_t AS ENUM (
    'SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS',
    'READY_FOR_VERIFICATION', 'RESOLVED', 'CLOSED', 'REOPENED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type_t AS ENUM (
    'COMPLAINT_SUBMITTED', 'COMPLAINT_ASSIGNED', 'STATUS_CHANGED', 'NEW_COMMENT',
    'SLA_NEARING', 'SLA_OVERDUE', 'READY_FOR_VERIFICATION', 'REOPENED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attachment_kind_t AS ENUM ('EVIDENCE', 'RESOLUTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status_t AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Hostel" (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  address    TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Block" (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  "hostelId" TEXT NOT NULL REFERENCES "Hostel"(id) ON DELETE CASCADE,
  UNIQUE ("hostelId", name)
);
CREATE INDEX IF NOT EXISTS idx_block_hostel ON "Block"("hostelId");

CREATE TABLE IF NOT EXISTS "Room" (
  id        TEXT PRIMARY KEY,
  number    TEXT NOT NULL,
  floor     INTEGER NOT NULL,
  "blockId" TEXT NOT NULL REFERENCES "Block"(id) ON DELETE CASCADE,
  UNIQUE ("blockId", number)
);
CREATE INDEX IF NOT EXISTS idx_room_block ON "Room"("blockId");

CREATE TABLE IF NOT EXISTS "Department" (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Category" (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SLAConfig" (
  id             TEXT PRIMARY KEY,
  "categoryId"   TEXT NOT NULL REFERENCES "Category"(id) ON DELETE CASCADE,
  priority       priority_t NOT NULL,
  "hoursToSolve" INTEGER NOT NULL CHECK ("hoursToSolve" > 0),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("categoryId", priority)
);

CREATE TABLE IF NOT EXISTS "User" (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          CITEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  role           role_t NOT NULL,
  phone          TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "roomId"       TEXT REFERENCES "Room"(id),
  "departmentId" TEXT REFERENCES "Department"(id),
  available      BOOLEAN NOT NULL DEFAULT true,
  specialties    TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"(role);
CREATE INDEX IF NOT EXISTS idx_user_department ON "User"("departmentId");
CREATE INDEX IF NOT EXISTS idx_user_room ON "User"("roomId");

CREATE TABLE IF NOT EXISTS "Complaint" (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  "categoryId"     TEXT NOT NULL REFERENCES "Category"(id),
  subcategory      TEXT,
  "locationNote"   TEXT,
  "blockId"        TEXT REFERENCES "Block"(id),
  "roomId"         TEXT REFERENCES "Room"(id),
  floor            INTEGER,
  priority         priority_t NOT NULL DEFAULT 'MEDIUM',
  status           complaint_status_t NOT NULL DEFAULT 'SUBMITTED',
  "reporterId"     TEXT NOT NULL REFERENCES "User"(id),
  "assigneeId"     TEXT REFERENCES "User"(id),
  "departmentId"   TEXT REFERENCES "Department"(id),
  "slaDeadline"    TIMESTAMPTZ,
  escalated        BOOLEAN NOT NULL DEFAULT false,
  "resolutionDate" TIMESTAMPTZ,
  "resolutionNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaint_status ON "Complaint"(status);
CREATE INDEX IF NOT EXISTS idx_complaint_priority ON "Complaint"(priority);
CREATE INDEX IF NOT EXISTS idx_complaint_reporter ON "Complaint"("reporterId");
CREATE INDEX IF NOT EXISTS idx_complaint_assignee ON "Complaint"("assigneeId");
CREATE INDEX IF NOT EXISTS idx_complaint_category ON "Complaint"("categoryId");
CREATE INDEX IF NOT EXISTS idx_complaint_block ON "Complaint"("blockId");
CREATE INDEX IF NOT EXISTS idx_complaint_created ON "Complaint"("createdAt");
CREATE INDEX IF NOT EXISTS idx_complaint_sla ON "Complaint"("slaDeadline");

CREATE TABLE IF NOT EXISTS "Assignment" (
  id             TEXT PRIMARY KEY,
  "complaintId"  TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
  "technicianId" TEXT NOT NULL REFERENCES "User"(id),
  "assignedById" TEXT REFERENCES "User"(id),
  status         assignment_status_t NOT NULL DEFAULT 'PENDING',
  note           TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignment_complaint ON "Assignment"("complaintId");
CREATE INDEX IF NOT EXISTS idx_assignment_technician ON "Assignment"("technicianId");

CREATE TABLE IF NOT EXISTS "Comment" (
  id            TEXT PRIMARY KEY,
  "complaintId" TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
  "authorId"    TEXT NOT NULL REFERENCES "User"(id),
  body          TEXT NOT NULL,
  "isInternal"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comment_complaint ON "Comment"("complaintId");

CREATE TABLE IF NOT EXISTS "Attachment" (
  id             TEXT PRIMARY KEY,
  "complaintId"  TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
  "uploadedById" TEXT NOT NULL REFERENCES "User"(id),
  "fileName"     TEXT NOT NULL,
  "filePath"     TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "fileSize"     INTEGER NOT NULL,
  kind           attachment_kind_t NOT NULL DEFAULT 'EVIDENCE',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- File bytes live in the database so the app also works on hosts without a persistent disk (e.g. Vercel).
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS data BYTEA;
CREATE INDEX IF NOT EXISTS idx_attachment_complaint ON "Attachment"("complaintId");

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  id               TEXT PRIMARY KEY,
  "complaintId"    TEXT NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
  "userId"         TEXT NOT NULL REFERENCES "User"(id),
  "previousStatus" TEXT,
  "newStatus"      TEXT NOT NULL,
  comment          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON "ActivityLog"("complaintId");
CREATE INDEX IF NOT EXISTS idx_activity_created ON "ActivityLog"("createdAt");

CREATE TABLE IF NOT EXISTS "Notification" (
  id            TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "complaintId" TEXT REFERENCES "Complaint"(id) ON DELETE CASCADE,
  type          notification_type_t NOT NULL,
  message       TEXT NOT NULL,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS idx_notification_read ON "Notification"("isRead");

CREATE TABLE IF NOT EXISTS "Rating" (
  id            TEXT PRIMARY KEY,
  "complaintId" TEXT UNIQUE NOT NULL REFERENCES "Complaint"(id) ON DELETE CASCADE,
  "studentId"   TEXT NOT NULL REFERENCES "User"(id),
  score         INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback      TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id          TEXT PRIMARY KEY,
  "actorId"   TEXT REFERENCES "User"(id),
  action      TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"  TEXT,
  metadata    TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_created ON "AuditLog"("createdAt");
