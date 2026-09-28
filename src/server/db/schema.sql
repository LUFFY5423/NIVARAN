-- Nivaran SQLite schema
-- NOTE: This file is the actual runtime schema (see prisma/schema.prisma for
-- the intended portable Prisma model, and README "Known limitations" for why
-- the two are separate in this prototype).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Hostel (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Block (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostelId TEXT NOT NULL REFERENCES Hostel(id) ON DELETE CASCADE,
  UNIQUE(hostelId, name)
);
CREATE INDEX IF NOT EXISTS idx_block_hostel ON Block(hostelId);

CREATE TABLE IF NOT EXISTS Room (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  floor INTEGER NOT NULL,
  blockId TEXT NOT NULL REFERENCES Block(id) ON DELETE CASCADE,
  UNIQUE(blockId, number)
);
CREATE INDEX IF NOT EXISTS idx_room_block ON Room(blockId);

CREATE TABLE IF NOT EXISTS Department (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Category (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SLAConfig (
  id TEXT PRIMARY KEY,
  categoryId TEXT NOT NULL REFERENCES Category(id) ON DELETE CASCADE,
  priority TEXT NOT NULL,
  hoursToSolve INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(categoryId, priority)
);

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL, -- STUDENT | ADMIN | TECHNICIAN
  phone TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  roomId TEXT REFERENCES Room(id),
  departmentId TEXT REFERENCES Department(id),
  available INTEGER NOT NULL DEFAULT 1,
  specialties TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_role ON User(role);
CREATE INDEX IF NOT EXISTS idx_user_department ON User(departmentId);
CREATE INDEX IF NOT EXISTS idx_user_room ON User(roomId);

CREATE TABLE IF NOT EXISTS Complaint (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  categoryId TEXT NOT NULL REFERENCES Category(id),
  subcategory TEXT,
  locationNote TEXT,
  blockId TEXT REFERENCES Block(id),
  roomId TEXT REFERENCES Room(id),
  floor INTEGER,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  reporterId TEXT NOT NULL REFERENCES User(id),
  assigneeId TEXT REFERENCES User(id),
  departmentId TEXT REFERENCES Department(id),
  slaDeadline TEXT,
  escalated INTEGER NOT NULL DEFAULT 0,
  resolutionDate TEXT,
  resolutionNotes TEXT,
  rejectionReason TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_status ON Complaint(status);
CREATE INDEX IF NOT EXISTS idx_complaint_priority ON Complaint(priority);
CREATE INDEX IF NOT EXISTS idx_complaint_reporter ON Complaint(reporterId);
CREATE INDEX IF NOT EXISTS idx_complaint_assignee ON Complaint(assigneeId);
CREATE INDEX IF NOT EXISTS idx_complaint_category ON Complaint(categoryId);
CREATE INDEX IF NOT EXISTS idx_complaint_block ON Complaint(blockId);
CREATE INDEX IF NOT EXISTS idx_complaint_created ON Complaint(createdAt);
CREATE INDEX IF NOT EXISTS idx_complaint_sla ON Complaint(slaDeadline);

CREATE TABLE IF NOT EXISTS Assignment (
  id TEXT PRIMARY KEY,
  complaintId TEXT NOT NULL REFERENCES Complaint(id) ON DELETE CASCADE,
  technicianId TEXT NOT NULL REFERENCES User(id),
  assignedById TEXT REFERENCES User(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignment_complaint ON Assignment(complaintId);
CREATE INDEX IF NOT EXISTS idx_assignment_technician ON Assignment(technicianId);

CREATE TABLE IF NOT EXISTS Comment (
  id TEXT PRIMARY KEY,
  complaintId TEXT NOT NULL REFERENCES Complaint(id) ON DELETE CASCADE,
  authorId TEXT NOT NULL REFERENCES User(id),
  body TEXT NOT NULL,
  isInternal INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comment_complaint ON Comment(complaintId);

CREATE TABLE IF NOT EXISTS Attachment (
  id TEXT PRIMARY KEY,
  complaintId TEXT NOT NULL REFERENCES Complaint(id) ON DELETE CASCADE,
  uploadedById TEXT NOT NULL REFERENCES User(id),
  fileName TEXT NOT NULL,
  filePath TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'EVIDENCE',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachment_complaint ON Attachment(complaintId);

CREATE TABLE IF NOT EXISTS ActivityLog (
  id TEXT PRIMARY KEY,
  complaintId TEXT NOT NULL REFERENCES Complaint(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES User(id),
  previousStatus TEXT,
  newStatus TEXT NOT NULL,
  comment TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON ActivityLog(complaintId);
CREATE INDEX IF NOT EXISTS idx_activity_created ON ActivityLog(createdAt);

CREATE TABLE IF NOT EXISTS Notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  complaintId TEXT REFERENCES Complaint(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  isRead INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification(userId);
CREATE INDEX IF NOT EXISTS idx_notification_read ON Notification(isRead);

CREATE TABLE IF NOT EXISTS Rating (
  id TEXT PRIMARY KEY,
  complaintId TEXT UNIQUE NOT NULL REFERENCES Complaint(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL REFERENCES User(id),
  score INTEGER NOT NULL,
  feedback TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  actorId TEXT REFERENCES User(id),
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  metadata TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON AuditLog(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_created ON AuditLog(createdAt);
