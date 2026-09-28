"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import {
  complaintSchema,
  commentSchema,
  ratingSchema,
  assignSchema,
  rejectSchema,
  resolveSchema,
  validateUploadedFile,
} from "@/lib/validation";
import { getSession } from "@/server/auth";
import {
  createComplaint,
  getComplaint,
  transitionComplaint,
  addComment,
  addAttachment,
  addRating,
  recordAssignment,
  updateAssignmentStatus,
} from "@/server/repo/complaints";
import { createNotification } from "@/server/repo/notifications";
import { writeAudit } from "@/server/repo/audit";
import type { ActionResult } from "@/server/actions/auth";
import { canViewComplaint } from "@/lib/permissions";
import type { Role } from "@/lib/types";

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function submitComplaintAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return { ok: false, error: "Only students can submit complaints" };
  }

  const parsed = complaintSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    subcategory: formData.get("subcategory") || undefined,
    blockId: formData.get("blockId") || undefined,
    roomId: formData.get("roomId") || undefined,
    floor: formData.get("floor") || undefined,
    priority: formData.get("priority"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const complaint = createComplaint({
    title: parsed.data.title,
    description: parsed.data.description,
    categoryId: parsed.data.categoryId,
    subcategory: parsed.data.subcategory || null,
    blockId: parsed.data.blockId || null,
    roomId: parsed.data.roomId || null,
    floor: parsed.data.floor ?? null,
    priority: parsed.data.priority,
    reporterId: session.id,
  });

  // Handle optional evidence image upload (prototype: stored on local disk)
  const file = formData.get("evidence");
  if (file instanceof File && file.size > 0) {
    const error = validateUploadedFile(file);
    if (error) return { ok: false, error };
    await saveUpload(complaint.id, session.id, file, "EVIDENCE");
  }

  revalidatePath("/student");
  revalidatePath("/admin");
  return { ok: true };
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function saveUpload(complaintId: string, userId: string, file: File, kind: "EVIDENCE" | "RESOLUTION") {
  // Files live outside /public and are served through /api/uploads/[name], which checks access.
  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const ext = EXT_BY_MIME[file.type] ?? "bin"; // extension comes from the validated MIME type, never the user's filename
  const safeName = `${complaintId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));
  addAttachment({
    complaintId,
    uploadedById: userId,
    fileName: file.name.slice(0, 120),
    filePath: `/api/uploads/${safeName}`,
    mimeType: file.type,
    fileSize: file.size,
    kind,
  });
}

function assertCanView(
  session: { id: string; role: Role },
  complaint: { reporterId: string; assigneeId: string | null }
) {
  return canViewComplaint(session, complaint);
}

export async function addCommentAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = commentSchema.safeParse({
    complaintId: formData.get("complaintId"),
    body: formData.get("body"),
    isInternal: formData.get("isInternal") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const complaint = getComplaint(parsed.data.complaintId);
  if (!complaint) return { ok: false, error: "Complaint not found" };
  if (!assertCanView(session, complaint)) return { ok: false, error: "You cannot access this complaint" };

  const isInternal = session.role !== "STUDENT" && !!parsed.data.isInternal;
  addComment(parsed.data.complaintId, session.id, parsed.data.body, isInternal);
  revalidatePath(`/complaints/${parsed.data.complaintId}`);
  return { ok: true };
}

export async function assignComplaintAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can assign complaints" };

  const parsed = assignSchema.safeParse({
    complaintId: formData.get("complaintId"),
    technicianId: formData.get("technicianId"),
    departmentId: formData.get("departmentId") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const complaint = getComplaint(parsed.data.complaintId);
  if (!complaint) return { ok: false, error: "Complaint not found" };

  // Auto-advance SUBMITTED/ASSIGNED -> UNDER_REVIEW -> ASSIGNED in one admin action
  // (SUBMITTED for first assignment, ASSIGNED for reassignment)
  if (complaint.status === "SUBMITTED" || complaint.status === "ASSIGNED") {
    const step = transitionComplaint(complaint.id, session, "UNDER_REVIEW", {
      comment: complaint.status === "ASSIGNED" ? "Reassignment requested" : "Moved to review for assignment",
    });
    if (!step.ok) return { ok: false, error: step.error };
  }
  const result = transitionComplaint(complaint.id, session, "ASSIGNED", {
    assigneeId: parsed.data.technicianId,
    departmentId: parsed.data.departmentId || undefined,
    comment: parsed.data.note || `Assigned to technician`,
  });
  if (!result.ok) return { ok: false, error: result.error };

  recordAssignment(complaint.id, parsed.data.technicianId, session.id, parsed.data.note);
  createNotification(
    parsed.data.technicianId,
    complaint.id,
    "COMPLAINT_ASSIGNED",
    `You have been assigned a new complaint: ${complaint.title}`
  );

  revalidatePath("/admin");
  revalidatePath(`/complaints/${complaint.id}`);
  revalidatePath("/technician");
  return { ok: true };
}

export async function technicianRespondAssignmentAction(complaintId: string, accept: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "TECHNICIAN") return { ok: false, error: "Only technicians can respond to assignments" };
  const complaint = getComplaint(complaintId);
  if (!complaint || complaint.assigneeId !== session.id) {
    return { ok: false, error: "This complaint is not assigned to you" };
  }

  updateAssignmentStatus(complaintId, session.id, accept ? "ACCEPTED" : "REJECTED");

  if (accept) {
    const result = transitionComplaint(complaintId, session, "ACCEPTED", { comment: "Technician accepted assignment" });
    if (!result.ok) return { ok: false, error: result.error };
  } else {
    const result = transitionComplaint(complaintId, session, "UNDER_REVIEW", {
      assigneeId: null,
      comment: "Technician declined assignment; returned to admin review",
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  revalidatePath("/technician");
  revalidatePath("/admin");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function startWorkAction(complaintId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "TECHNICIAN") return { ok: false, error: "Only technicians can update work status" };
  const complaint = getComplaint(complaintId);
  if (!complaint || complaint.assigneeId !== session.id) return { ok: false, error: "Not assigned to you" };

  const result = transitionComplaint(complaintId, session, "IN_PROGRESS", { comment: "Work started" });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/technician");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function markReadyForVerificationAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "TECHNICIAN") return { ok: false, error: "Only technicians can update work status" };

  const parsed = resolveSchema.safeParse({
    complaintId: formData.get("complaintId"),
    resolutionNotes: formData.get("resolutionNotes"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const complaint = getComplaint(parsed.data.complaintId);
  if (!complaint || complaint.assigneeId !== session.id) return { ok: false, error: "Not assigned to you" };

  const file = formData.get("resolutionEvidence");
  if (file instanceof File && file.size > 0) {
    const error = validateUploadedFile(file);
    if (error) return { ok: false, error };
    await saveUpload(complaint.id, session.id, file, "RESOLUTION");
  }

  const result = transitionComplaint(complaint.id, session, "READY_FOR_VERIFICATION", {
    resolutionNotes: parsed.data.resolutionNotes,
    comment: "Marked ready for student verification",
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/technician");
  revalidatePath(`/complaints/${complaint.id}`);
  return { ok: true };
}

export async function studentConfirmResolutionAction(complaintId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "STUDENT") return { ok: false, error: "Only students can confirm resolution" };
  const complaint = getComplaint(complaintId);
  if (!complaint || complaint.reporterId !== session.id) return { ok: false, error: "Not your complaint" };

  const result = transitionComplaint(complaintId, session, "RESOLVED", { comment: "Student confirmed the fix" });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/student");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function studentReopenAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "STUDENT") return { ok: false, error: "Only students can reopen complaints" };

  const complaintId = String(formData.get("complaintId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const complaint = getComplaint(complaintId);
  if (!complaint || complaint.reporterId !== session.id) return { ok: false, error: "Not your complaint" };
  if (!["RESOLVED", "CLOSED", "READY_FOR_VERIFICATION"].includes(complaint.status)) {
    return { ok: false, error: "Only a resolved complaint can be reopened" };
  }

  // Direct transition helper for READY_FOR_VERIFICATION -> not-fixed case is handled
  // via the general transition table (READY_FOR_VERIFICATION -> IN_PROGRESS instead).
  if (complaint.status === "READY_FOR_VERIFICATION") {
    const result = transitionComplaint(complaintId, session, "IN_PROGRESS", {
      comment: reason || "Student says the issue is not fixed yet",
    });
    if (!result.ok) return { ok: false, error: result.error };
  } else {
    const result = transitionComplaint(complaintId, session, "REOPENED", {
      comment: reason || "Student reopened the complaint",
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  revalidatePath("/student");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function rateComplaintAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "STUDENT") return { ok: false, error: "Only students can rate resolutions" };

  const parsed = ratingSchema.safeParse({
    complaintId: formData.get("complaintId"),
    score: formData.get("score"),
    feedback: formData.get("feedback") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const complaint = getComplaint(parsed.data.complaintId);
  if (!complaint || complaint.reporterId !== session.id) return { ok: false, error: "Not your complaint" };
  if (!["RESOLVED", "CLOSED"].includes(complaint.status)) {
    return { ok: false, error: "You can only rate a resolved complaint" };
  }

  try {
    addRating(complaint.id, session.id, parsed.data.score, parsed.data.feedback || undefined);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save rating" };
  }
  revalidatePath(`/complaints/${complaint.id}`);
  return { ok: true };
}

export async function adminCloseComplaintAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can close complaints" };
  const complaintId = String(formData.get("complaintId") || "");
  const result = transitionComplaint(complaintId, session, "CLOSED", { comment: "Closed by administrator" });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function adminRejectComplaintAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can reject complaints" };
  const parsed = rejectSchema.safeParse({
    complaintId: formData.get("complaintId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = transitionComplaint(parsed.data.complaintId, session, "REJECTED", {
    rejectionReason: parsed.data.reason,
    comment: parsed.data.reason,
  });
  if (!result.ok) return { ok: false, error: result.error };
  writeAudit(session.id, "COMPLAINT_REJECTED", "Complaint", parsed.data.complaintId, {
    reason: parsed.data.reason,
  });
  revalidatePath("/admin");
  revalidatePath(`/complaints/${parsed.data.complaintId}`);
  return { ok: true };
}

export async function adminChangePriorityAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can change priority" };
  const complaintId = String(formData.get("complaintId") || "");
  const priority = String(formData.get("priority") || "");
  if (!["LOW", "MEDIUM", "HIGH", "EMERGENCY"].includes(priority)) {
    return { ok: false, error: "Invalid priority" };
  }
  const complaint = getComplaint(complaintId);
  if (!complaint) return { ok: false, error: "Complaint not found" };

  const { getDb, nowIso } = await import("@/server/db/client");
  getDb().prepare("UPDATE Complaint SET priority = ?, updatedAt = ? WHERE id = ?").run(priority, nowIso(), complaintId);
  writeAudit(session.id, "PRIORITY_CHANGED", "Complaint", complaintId, { priority });
  revalidatePath("/admin");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}

export async function runSlaCheckAction(): Promise<ActionResult & { escalated?: number; nearing?: number }> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can run the SLA check" };
  const { runSlaCheck } = await import("@/server/repo/complaints");
  const result = runSlaCheck(session.id);
  revalidatePath("/admin");
  return { ok: true, ...result };
}

/** Administrator override: close a complaint without student confirmation. Reason is mandatory and recorded. */
export async function adminOverrideCloseAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { ok: false, error: "Only administrators can override-close complaints" };
  const complaintId = String(formData.get("complaintId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 5) return { ok: false, error: "A reason of at least 5 characters is required" };

  const complaint = getComplaint(complaintId);
  if (!complaint) return { ok: false, error: "Complaint not found" };
  if (complaint.status === "CLOSED" || complaint.status === "REJECTED") {
    return { ok: false, error: "This complaint is already finished" };
  }

  const { getDb, nowIso } = await import("@/server/db/client");
  const { addActivityLog } = await import("@/server/repo/complaints");
  const ts = nowIso();
  getDb()
    .prepare(
      "UPDATE Complaint SET status = 'CLOSED', resolutionDate = COALESCE(resolutionDate, ?), updatedAt = ? WHERE id = ?"
    )
    .run(ts, ts, complaintId);
  addActivityLog(complaintId, session.id, complaint.status, "CLOSED", `Administrator override: ${reason}`);
  writeAudit(session.id, "ADMIN_OVERRIDE_CLOSE", "Complaint", complaintId, { reason, from: complaint.status });
  createNotification(complaint.reporterId, complaintId, "STATUS_CHANGED", "An administrator closed your complaint");
  revalidatePath("/admin");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true };
}
