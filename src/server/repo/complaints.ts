import { getDb, genId, nowIso } from "@/server/db/client";
import { getSLAHours } from "@/server/repo/reference-data";
import { createNotification } from "@/server/repo/notifications";
import { writeAudit } from "@/server/repo/audit";
import { STATUS_TRANSITIONS } from "@/lib/types";
import { isPastDeadline } from "@/lib/sla";
import { canActorSetStatus } from "@/lib/permissions";
import type { ComplaintRow, ComplaintStatus, Priority, SessionUser } from "@/lib/types";

export interface ComplaintFilters {
  status?: ComplaintStatus;
  category?: string;
  priority?: Priority;
  blockId?: string;
  assigneeId?: string;
  reporterId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function listComplaints(filters: ComplaintFilters = {}): ComplaintRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.category) {
    clauses.push("categoryId = ?");
    params.push(filters.category);
  }
  if (filters.priority) {
    clauses.push("priority = ?");
    params.push(filters.priority);
  }
  if (filters.blockId) {
    clauses.push("blockId = ?");
    params.push(filters.blockId);
  }
  if (filters.assigneeId) {
    clauses.push("assigneeId = ?");
    params.push(filters.assigneeId);
  }
  if (filters.reporterId) {
    clauses.push("reporterId = ?");
    params.push(filters.reporterId);
  }
  if (filters.dateFrom) {
    clauses.push("createdAt >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("createdAt <= ?");
    params.push(filters.dateTo);
  }
  if (filters.search) {
    clauses.push("(title LIKE ? OR description LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM Complaint ${where} ORDER BY createdAt DESC`).all(...params) as ComplaintRow[];
}

export function getComplaint(id: string): ComplaintRow | undefined {
  return getDb().prepare("SELECT * FROM Complaint WHERE id = ?").get(id) as ComplaintRow | undefined;
}

export function createComplaint(input: {
  title: string;
  description: string;
  categoryId: string;
  subcategory?: string | null;
  locationNote?: string | null;
  blockId?: string | null;
  roomId?: string | null;
  floor?: number | null;
  priority: Priority;
  reporterId: string;
}): ComplaintRow {
  const db = getDb();
  const id = genId("cmp_");
  const ts = nowIso();
  const hours = getSLAHours(input.categoryId, input.priority);
  const slaDeadline = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  db.prepare(
    `INSERT INTO Complaint
      (id, title, description, categoryId, subcategory, locationNote, blockId, roomId, floor,
       priority, status, reporterId, slaDeadline, escalated, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.title,
    input.description,
    input.categoryId,
    input.subcategory ?? null,
    input.locationNote ?? null,
    input.blockId ?? null,
    input.roomId ?? null,
    input.floor ?? null,
    input.priority,
    input.reporterId,
    slaDeadline,
    ts,
    ts
  );

  addActivityLog(id, input.reporterId, null, "SUBMITTED", "Complaint submitted by student");
  writeAudit(input.reporterId, "COMPLAINT_CREATED", "Complaint", id);

  return getComplaint(id)!;
}

/** Validates and applies a status transition, recording history + notifications. */
export function transitionComplaint(
  complaintId: string,
  actor: SessionUser,
  newStatus: ComplaintStatus,
  opts: {
    comment?: string;
    assigneeId?: string | null;
    departmentId?: string | null;
    rejectionReason?: string | null;
    resolutionNotes?: string | null;
  } = {}
): { ok: true; complaint: ComplaintRow } | { ok: false; error: string } {
  const complaint = getComplaint(complaintId);
  if (!complaint) return { ok: false, error: "Complaint not found" };

  if (!canActorSetStatus(actor, newStatus, complaint)) {
    return { ok: false, error: "You are not allowed to make this status change" };
  }

  const allowed = STATUS_TRANSITIONS[complaint.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      error: `Cannot move complaint from ${complaint.status} to ${newStatus}`,
    };
  }

  if (newStatus === "REJECTED" && actor.role !== "ADMIN") {
    return { ok: false, error: "Only administrators can reject a complaint, and must give a reason" };
  }
  if (newStatus === "REJECTED" && !opts.rejectionReason) {
    return { ok: false, error: "A rejection reason is required" };
  }

  const db = getDb();
  const ts = nowIso();
  const sets: string[] = ["status = ?", "updatedAt = ?"];
  const params: unknown[] = [newStatus, ts];

  if (opts.assigneeId !== undefined) {
    sets.push("assigneeId = ?");
    params.push(opts.assigneeId);
  }
  if (opts.departmentId !== undefined) {
    sets.push("departmentId = ?");
    params.push(opts.departmentId);
  }
  if (newStatus === "REJECTED") {
    sets.push("rejectionReason = ?");
    params.push(opts.rejectionReason ?? null);
  }
  if (opts.resolutionNotes) {
    // Technician's record of the work performed, saved when marking ready for verification
    sets.push("resolutionNotes = ?");
    params.push(opts.resolutionNotes);
  }
  if (newStatus === "RESOLVED") {
    sets.push("resolutionDate = ?");
    params.push(ts);
  }
  if (newStatus === "REOPENED") {
    // clear prior resolution markers so the SLA/analytics reflect the new cycle
    sets.push("resolutionDate = ?");
    params.push(null);
  }

  db.prepare(`UPDATE Complaint SET ${sets.join(", ")} WHERE id = ?`).run(...params, complaintId);

  addActivityLog(complaintId, actor.id, complaint.status, newStatus, opts.comment ?? null);
  writeAudit(actor.id, `STATUS_${newStatus}`, "Complaint", complaintId, {
    from: complaint.status,
    to: newStatus,
  });

  notifyForTransition(complaint, newStatus, actor);

  return { ok: true, complaint: getComplaint(complaintId)! };
}

function notifyForTransition(before: ComplaintRow, newStatus: ComplaintStatus, actor: SessionUser) {
  const targets = new Set<string>();
  if (before.reporterId !== actor.id) targets.add(before.reporterId);
  if (before.assigneeId && before.assigneeId !== actor.id) targets.add(before.assigneeId);

  const messages: Partial<Record<ComplaintStatus, string>> = {
    ASSIGNED: "Your complaint has been assigned to a technician",
    ACCEPTED: "The technician accepted your complaint",
    IN_PROGRESS: "Work has started on your complaint",
    READY_FOR_VERIFICATION: "Your complaint is ready for you to verify",
    RESOLVED: "Your complaint has been marked resolved",
    CLOSED: "Your complaint has been closed",
    REOPENED: "A complaint was reopened by the student",
    REJECTED: "Your complaint was rejected by an administrator",
  };
  const message = messages[newStatus] ?? `Complaint status changed to ${newStatus}`;
  const type =
    newStatus === "READY_FOR_VERIFICATION"
      ? "READY_FOR_VERIFICATION"
      : newStatus === "REOPENED"
        ? "REOPENED"
        : newStatus === "ASSIGNED"
          ? "COMPLAINT_ASSIGNED"
          : "STATUS_CHANGED";

  for (const userId of targets) {
    createNotification(userId, before.id, type, message);
  }
}

export function addActivityLog(
  complaintId: string,
  userId: string,
  previousStatus: string | null,
  newStatus: string,
  comment?: string | null
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ActivityLog (id, complaintId, userId, previousStatus, newStatus, comment, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(genId("act_"), complaintId, userId, previousStatus, newStatus, comment ?? null, nowIso());
}

export interface ActivityLogRow {
  id: string;
  complaintId: string;
  userId: string;
  previousStatus: string | null;
  newStatus: string;
  comment: string | null;
  createdAt: string;
}
export function listActivity(complaintId: string): ActivityLogRow[] {
  return getDb()
    .prepare("SELECT * FROM ActivityLog WHERE complaintId = ? ORDER BY createdAt ASC")
    .all(complaintId) as ActivityLogRow[];
}

// ---------- Comments ----------
export interface CommentRow {
  id: string;
  complaintId: string;
  authorId: string;
  body: string;
  isInternal: number;
  createdAt: string;
}
export function addComment(complaintId: string, authorId: string, body: string, isInternal = false): CommentRow {
  const db = getDb();
  const id = genId("cmt_");
  const ts = nowIso();
  db.prepare(
    `INSERT INTO Comment (id, complaintId, authorId, body, isInternal, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, complaintId, authorId, body, isInternal ? 1 : 0, ts);

  const complaint = getComplaint(complaintId);
  if (complaint) {
    const targets = new Set<string>();
    if (complaint.reporterId !== authorId && !isInternal) targets.add(complaint.reporterId);
    if (complaint.assigneeId && complaint.assigneeId !== authorId) targets.add(complaint.assigneeId);
    for (const userId of targets) {
      createNotification(userId, complaintId, "NEW_COMMENT", "New comment on your complaint");
    }
  }
  return db.prepare("SELECT * FROM Comment WHERE id = ?").get(id) as CommentRow;
}
export function listComments(complaintId: string, includeInternal: boolean): CommentRow[] {
  const db = getDb();
  if (includeInternal) {
    return db
      .prepare("SELECT * FROM Comment WHERE complaintId = ? ORDER BY createdAt ASC")
      .all(complaintId) as CommentRow[];
  }
  return db
    .prepare("SELECT * FROM Comment WHERE complaintId = ? AND isInternal = 0 ORDER BY createdAt ASC")
    .all(complaintId) as CommentRow[];
}

// ---------- Attachments ----------
export interface AttachmentRow {
  id: string;
  complaintId: string;
  uploadedById: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  kind: string;
  createdAt: string;
}
export function addAttachment(input: {
  complaintId: string;
  uploadedById: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  kind: "EVIDENCE" | "RESOLUTION";
}): AttachmentRow {
  const db = getDb();
  const id = genId("att_");
  db.prepare(
    `INSERT INTO Attachment (id, complaintId, uploadedById, fileName, filePath, mimeType, fileSize, kind, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.complaintId,
    input.uploadedById,
    input.fileName,
    input.filePath,
    input.mimeType,
    input.fileSize,
    input.kind,
    nowIso()
  );
  return db.prepare("SELECT * FROM Attachment WHERE id = ?").get(id) as AttachmentRow;
}
export function listAttachments(complaintId: string): AttachmentRow[] {
  return getDb()
    .prepare("SELECT * FROM Attachment WHERE complaintId = ? ORDER BY createdAt ASC")
    .all(complaintId) as AttachmentRow[];
}

// ---------- Ratings ----------
export interface RatingRow {
  id: string;
  complaintId: string;
  studentId: string;
  score: number;
  feedback: string | null;
  createdAt: string;
}
export function addRating(complaintId: string, studentId: string, score: number, feedback?: string) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM Rating WHERE complaintId = ?").get(complaintId);
  if (existing) throw new Error("This complaint has already been rated");
  db.prepare(
    `INSERT INTO Rating (id, complaintId, studentId, score, feedback, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(genId("rtg_"), complaintId, studentId, score, feedback ?? null, nowIso());
}
export function getRating(complaintId: string): RatingRow | undefined {
  return getDb().prepare("SELECT * FROM Rating WHERE complaintId = ?").get(complaintId) as RatingRow | undefined;
}

// ---------- Assignment ----------
export function recordAssignment(complaintId: string, technicianId: string, assignedById: string, note?: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO Assignment (id, complaintId, technicianId, assignedById, status, note, createdAt)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
  ).run(genId("asg_"), complaintId, technicianId, assignedById, note ?? null, nowIso());
}
export function updateAssignmentStatus(complaintId: string, technicianId: string, status: "ACCEPTED" | "REJECTED") {
  const db = getDb();
  db.prepare(`UPDATE Assignment SET status = ? WHERE complaintId = ? AND technicianId = ? AND status = 'PENDING'`).run(
    status,
    complaintId,
    technicianId
  );
}

// ---------- SLA / Escalation ----------
/** Scans for complaints past their SLA deadline and marks them escalated + notifies admins. */
export function runSlaCheck(adminId: string): { escalated: number; nearing: number } {
  const db = getDb();
  const now = new Date();
  const activeStatuses: ComplaintStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"];
  const placeholders = activeStatuses.map(() => "?").join(",");

  const overdue = db
    .prepare(
      `SELECT * FROM Complaint WHERE status IN (${placeholders}) AND escalated = 0 AND slaDeadline IS NOT NULL AND slaDeadline < ?`
    )
    .all(...activeStatuses, now.toISOString()) as ComplaintRow[];

  for (const c of overdue) {
    db.prepare("UPDATE Complaint SET escalated = 1, updatedAt = ? WHERE id = ?").run(nowIso(), c.id);
    addActivityLog(c.id, adminId, c.status, c.status, "Automatically escalated: SLA deadline passed");
    createNotification(
      c.reporterId,
      c.id,
      "SLA_OVERDUE",
      "Your complaint has passed its SLA deadline and was escalated"
    );
    if (c.assigneeId) {
      createNotification(c.assigneeId, c.id, "SLA_OVERDUE", "A complaint assigned to you is overdue and was escalated");
    }
  }
  writeAudit(adminId, "SLA_CHECK_RUN", "Complaint", null, { escalatedCount: overdue.length });

  // "Nearing deadline" = within 20% of the SLA window, not yet overdue
  const nearingCandidates = db
    .prepare(
      `SELECT * FROM Complaint WHERE status IN (${placeholders}) AND escalated = 0 AND slaDeadline IS NOT NULL AND slaDeadline >= ?`
    )
    .all(...activeStatuses, now.toISOString()) as ComplaintRow[];
  let nearingCount = 0;
  for (const c of nearingCandidates) {
    const deadline = new Date(c.slaDeadline!).getTime();
    const created = new Date(c.createdAt).getTime();
    const total = deadline - created;
    const remaining = deadline - now.getTime();
    if (total > 0 && remaining / total <= 0.2) {
      nearingCount += 1;
      createNotification(c.reporterId, c.id, "SLA_NEARING", "Your complaint is nearing its SLA deadline");
    }
  }

  return { escalated: overdue.length, nearing: nearingCount };
}

export function isOverdue(complaint: ComplaintRow): boolean {
  return isPastDeadline(complaint.status, complaint.slaDeadline);
}
