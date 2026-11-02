import { query, queryOne, execute, genId, nowIso } from "@/server/db/client";
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

export async function listComplaints(filters: ComplaintFilters = {}): Promise<ComplaintRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.status) add(`status = ?`, filters.status);
  if (filters.category) add(`"categoryId" = ?`, filters.category);
  if (filters.priority) add(`priority = ?`, filters.priority);
  if (filters.blockId) add(`"blockId" = ?`, filters.blockId);
  if (filters.assigneeId) add(`"assigneeId" = ?`, filters.assigneeId);
  if (filters.reporterId) add(`"reporterId" = ?`, filters.reporterId);
  if (filters.dateFrom) add(`"createdAt" >= ?`, filters.dateFrom);
  if (filters.dateTo) add(`"createdAt" <= ?`, filters.dateTo);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    clauses.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<ComplaintRow>(`SELECT * FROM "Complaint" ${where} ORDER BY "createdAt" DESC`, params);
}

export async function getComplaint(id: string): Promise<ComplaintRow | undefined> {
  return queryOne<ComplaintRow>(`SELECT * FROM "Complaint" WHERE id = $1`, [id]);
}

export async function createComplaint(input: {
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
}): Promise<ComplaintRow> {
  const id = genId("cmp_");
  const ts = nowIso();
  const hours = await getSLAHours(input.categoryId, input.priority);
  const slaDeadline = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  await execute(
    `INSERT INTO "Complaint"
      (id, title, description, "categoryId", subcategory, "locationNote", "blockId", "roomId", floor,
       priority, status, "reporterId", "slaDeadline", escalated, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SUBMITTED', $11, $12, false, $13, $13)`,
    [
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
    ]
  );

  await addActivityLog(id, input.reporterId, null, "SUBMITTED", "Complaint submitted by student");
  await writeAudit(input.reporterId, "COMPLAINT_CREATED", "Complaint", id);

  return (await getComplaint(id))!;
}

/** Validates and applies a status transition, recording history + notifications. */
export async function transitionComplaint(
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
): Promise<{ ok: true; complaint: ComplaintRow } | { ok: false; error: string }> {
  const complaint = await getComplaint(complaintId);
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

  const ts = nowIso();
  const params: unknown[] = [];
  const sets: string[] = [];
  const set = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  set(`status`, newStatus);
  set(`"updatedAt"`, ts);
  if (opts.assigneeId !== undefined) set(`"assigneeId"`, opts.assigneeId);
  if (opts.departmentId !== undefined) set(`"departmentId"`, opts.departmentId);
  if (newStatus === "REJECTED") set(`"rejectionReason"`, opts.rejectionReason ?? null);
  // Technician's record of the work performed, saved when marking ready for verification
  if (opts.resolutionNotes) set(`"resolutionNotes"`, opts.resolutionNotes);
  if (newStatus === "RESOLVED") set(`"resolutionDate"`, ts);
  // clear prior resolution markers so the SLA/analytics reflect the new cycle
  if (newStatus === "REOPENED") set(`"resolutionDate"`, null);

  params.push(complaintId);
  await execute(`UPDATE "Complaint" SET ${sets.join(", ")} WHERE id = $${params.length}`, params);

  await addActivityLog(complaintId, actor.id, complaint.status, newStatus, opts.comment ?? null);
  await writeAudit(actor.id, `STATUS_${newStatus}`, "Complaint", complaintId, {
    from: complaint.status,
    to: newStatus,
  });

  await notifyForTransition(complaint, newStatus, actor);

  return { ok: true, complaint: (await getComplaint(complaintId))! };
}

async function notifyForTransition(before: ComplaintRow, newStatus: ComplaintStatus, actor: SessionUser) {
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
    await createNotification(userId, before.id, type, message);
  }
}

export async function addActivityLog(
  complaintId: string,
  userId: string,
  previousStatus: string | null,
  newStatus: string,
  comment?: string | null
): Promise<void> {
  await execute(
    `INSERT INTO "ActivityLog" (id, "complaintId", "userId", "previousStatus", "newStatus", comment, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [genId("act_"), complaintId, userId, previousStatus, newStatus, comment ?? null, nowIso()]
  );
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
export async function listActivity(complaintId: string): Promise<ActivityLogRow[]> {
  return query<ActivityLogRow>(`SELECT * FROM "ActivityLog" WHERE "complaintId" = $1 ORDER BY "createdAt" ASC`, [
    complaintId,
  ]);
}

// ---------- Comments ----------
export interface CommentRow {
  id: string;
  complaintId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}
export async function addComment(
  complaintId: string,
  authorId: string,
  body: string,
  isInternal = false
): Promise<CommentRow> {
  const id = genId("cmt_");
  await execute(
    `INSERT INTO "Comment" (id, "complaintId", "authorId", body, "isInternal", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, complaintId, authorId, body, isInternal, nowIso()]
  );

  const complaint = await getComplaint(complaintId);
  if (complaint) {
    const targets = new Set<string>();
    if (complaint.reporterId !== authorId && !isInternal) targets.add(complaint.reporterId);
    if (complaint.assigneeId && complaint.assigneeId !== authorId) targets.add(complaint.assigneeId);
    for (const userId of targets) {
      await createNotification(userId, complaintId, "NEW_COMMENT", "New comment on your complaint");
    }
  }
  return (await queryOne<CommentRow>(`SELECT * FROM "Comment" WHERE id = $1`, [id]))!;
}
export async function listComments(complaintId: string, includeInternal: boolean): Promise<CommentRow[]> {
  if (includeInternal) {
    return query<CommentRow>(`SELECT * FROM "Comment" WHERE "complaintId" = $1 ORDER BY "createdAt" ASC`, [
      complaintId,
    ]);
  }
  return query<CommentRow>(
    `SELECT * FROM "Comment" WHERE "complaintId" = $1 AND "isInternal" = false ORDER BY "createdAt" ASC`,
    [complaintId]
  );
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
// Never SELECT * here: the BYTEA `data` column must only be read when serving the file.
const ATTACHMENT_COLUMNS = `id, "complaintId", "uploadedById", "fileName", "filePath", "mimeType", "fileSize", kind, "createdAt"`;
export async function addAttachment(input: {
  complaintId: string;
  uploadedById: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  kind: "EVIDENCE" | "RESOLUTION";
  data: Buffer;
}): Promise<AttachmentRow> {
  const id = genId("att_");
  await execute(
    `INSERT INTO "Attachment" (id, "complaintId", "uploadedById", "fileName", "filePath", "mimeType", "fileSize", kind, "createdAt", data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.complaintId,
      input.uploadedById,
      input.fileName,
      input.filePath,
      input.mimeType,
      input.fileSize,
      input.kind,
      nowIso(),
      input.data,
    ]
  );
  return (await queryOne<AttachmentRow>(`SELECT ${ATTACHMENT_COLUMNS} FROM "Attachment" WHERE id = $1`, [id]))!;
}
export async function listAttachments(complaintId: string): Promise<AttachmentRow[]> {
  return query<AttachmentRow>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM "Attachment" WHERE "complaintId" = $1 ORDER BY "createdAt" ASC`,
    [complaintId]
  );
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
export async function addRating(
  complaintId: string,
  studentId: string,
  score: number,
  feedback?: string
): Promise<void> {
  const existing = await queryOne(`SELECT id FROM "Rating" WHERE "complaintId" = $1`, [complaintId]);
  if (existing) throw new Error("This complaint has already been rated");
  await execute(
    `INSERT INTO "Rating" (id, "complaintId", "studentId", score, feedback, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`,
    [genId("rtg_"), complaintId, studentId, score, feedback ?? null, nowIso()]
  );
}
export async function getRating(complaintId: string): Promise<RatingRow | undefined> {
  return queryOne<RatingRow>(`SELECT * FROM "Rating" WHERE "complaintId" = $1`, [complaintId]);
}

// ---------- Assignment ----------
export async function recordAssignment(
  complaintId: string,
  technicianId: string,
  assignedById: string,
  note?: string
): Promise<void> {
  await execute(
    `INSERT INTO "Assignment" (id, "complaintId", "technicianId", "assignedById", status, note, "createdAt")
     VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)`,
    [genId("asg_"), complaintId, technicianId, assignedById, note ?? null, nowIso()]
  );
}
export async function updateAssignmentStatus(
  complaintId: string,
  technicianId: string,
  status: "ACCEPTED" | "REJECTED"
): Promise<void> {
  await execute(
    `UPDATE "Assignment" SET status = $1 WHERE "complaintId" = $2 AND "technicianId" = $3 AND status = 'PENDING'`,
    [status, complaintId, technicianId]
  );
}

// ---------- SLA / Escalation ----------
const ACTIVE_STATUSES: ComplaintStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"];

/** Scans for complaints past their SLA deadline and marks them escalated + notifies the people involved. */
export async function runSlaCheck(adminId: string): Promise<{ escalated: number; nearing: number }> {
  const now = new Date();

  const overdue = await query<ComplaintRow>(
    `SELECT * FROM "Complaint"
     WHERE status = ANY($1::complaint_status_t[]) AND escalated = false
       AND "slaDeadline" IS NOT NULL AND "slaDeadline" < $2`,
    [ACTIVE_STATUSES, now.toISOString()]
  );

  for (const c of overdue) {
    await execute(`UPDATE "Complaint" SET escalated = true, "updatedAt" = $1 WHERE id = $2`, [nowIso(), c.id]);
    await addActivityLog(c.id, adminId, c.status, c.status, "Automatically escalated: SLA deadline passed");
    await createNotification(
      c.reporterId,
      c.id,
      "SLA_OVERDUE",
      "Your complaint has passed its SLA deadline and was escalated"
    );
    if (c.assigneeId) {
      await createNotification(
        c.assigneeId,
        c.id,
        "SLA_OVERDUE",
        "A complaint assigned to you is overdue and was escalated"
      );
    }
  }
  await writeAudit(adminId, "SLA_CHECK_RUN", "Complaint", null, { escalatedCount: overdue.length });

  // "Nearing deadline" = within 20% of the SLA window, not yet overdue
  const nearingCandidates = await query<ComplaintRow>(
    `SELECT * FROM "Complaint"
     WHERE status = ANY($1::complaint_status_t[]) AND escalated = false
       AND "slaDeadline" IS NOT NULL AND "slaDeadline" >= $2`,
    [ACTIVE_STATUSES, now.toISOString()]
  );
  let nearingCount = 0;
  for (const c of nearingCandidates) {
    const deadline = new Date(c.slaDeadline!).getTime();
    const created = new Date(c.createdAt).getTime();
    const total = deadline - created;
    const remaining = deadline - now.getTime();
    if (total > 0 && remaining / total <= 0.2) {
      nearingCount += 1;
      await createNotification(c.reporterId, c.id, "SLA_NEARING", "Your complaint is nearing its SLA deadline");
    }
  }

  return { escalated: overdue.length, nearing: nearingCount };
}

export function isOverdue(complaint: ComplaintRow): boolean {
  return isPastDeadline(complaint.status, complaint.slaDeadline);
}
