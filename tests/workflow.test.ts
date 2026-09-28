import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import {
  transitionComplaint,
  getComplaint,
  listActivity,
  listComplaints,
  runSlaCheck,
  isOverdue,
  addRating,
  recordAssignment,
} from "@/server/repo/complaints";
import { listNotifications } from "@/server/repo/notifications";
import { getDb } from "@/server/db/client";
import { adminOverview, publicStats } from "@/server/repo/analytics";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "@/server/auth";
import { findUserByEmail } from "@/server/repo/reference-data";

function fullResolve(t: ReturnType<typeof setup>, id: string) {
  const { admin, tech, student } = t;
  expect(transitionComplaint(id, admin, "UNDER_REVIEW").ok).toBe(true);
  expect(transitionComplaint(id, admin, "ASSIGNED", { assigneeId: tech.id }).ok).toBe(true);
  expect(transitionComplaint(id, tech, "ACCEPTED").ok).toBe(true);
  expect(transitionComplaint(id, tech, "IN_PROGRESS").ok).toBe(true);
  expect(transitionComplaint(id, tech, "READY_FOR_VERIFICATION", { resolutionNotes: "Replaced capacitor" }).ok).toBe(
    true
  );
  expect(transitionComplaint(id, student, "RESOLVED").ok).toBe(true);
}

describe("authentication", () => {
  it("hashes passwords and verifies them", async () => {
    const h = await hashPassword("Password123!");
    expect(h).not.toContain("Password123!");
    expect(await verifyPassword("Password123!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("issues and verifies session tokens, rejecting tampering", async () => {
    const t = setup();
    const token = await createSessionToken(t.student);
    expect((await verifySessionToken(token))?.role).toBe("STUDENT");
    expect(await verifySessionToken(token.slice(0, -3) + "abc")).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });
  it("looks users up by email case-insensitively", () => {
    setup();
    expect(findUserByEmail("ADMIN.ONE@test.dev")?.role).toBe("ADMIN");
  });
});

describe("complaint creation", () => {
  it("creates a SUBMITTED complaint with SLA deadline, timeline entry and audit log", () => {
    const t = setup();
    const c = t.newComplaint("HIGH");
    expect(c.status).toBe("SUBMITTED");
    const hours = (new Date(c.slaDeadline!).getTime() - new Date(c.createdAt).getTime()) / 3600000;
    expect(Math.round(hours)).toBe(24);
    expect(listActivity(c.id)).toHaveLength(1);
    const audits = getDb().prepare("SELECT * FROM AuditLog WHERE action='COMPLAINT_CREATED'").all();
    expect(audits).toHaveLength(1);
  });
});

describe("assignment and status transitions", () => {
  it("runs the full lifecycle and records every step in the timeline", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    const done = getComplaint(c.id)!;
    expect(done.status).toBe("RESOLVED");
    expect(done.assigneeId).toBe(t.tech.id);
    expect(done.resolutionDate).toBeTruthy();
    expect(done.resolutionNotes).toBe("Replaced capacitor");
    const log = listActivity(c.id);
    expect(log.map((l) => l.newStatus)).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "ASSIGNED",
      "ACCEPTED",
      "IN_PROGRESS",
      "READY_FOR_VERIFICATION",
      "RESOLVED",
    ]);
    expect(log[2].previousStatus).toBe("UNDER_REVIEW");
    expect(log.every((l) => l.userId && l.createdAt)).toBe(true);
  });

  it("notifies the student and technician on key transitions", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    const types = listNotifications(t.student.id).map((n) => n.type);
    expect(types).toContain("COMPLAINT_ASSIGNED");
    expect(types).toContain("READY_FOR_VERIFICATION");
  });

  it("rejects invalid jumps in the lifecycle", () => {
    const t = setup();
    const c = t.newComplaint();
    const r = transitionComplaint(c.id, t.admin, "CLOSED");
    expect(r.ok).toBe(false);
    expect(getComplaint(c.id)!.status).toBe("SUBMITTED");
  });

  it("only admins can reject, and a reason is mandatory", () => {
    const t = setup();
    const c = t.newComplaint();
    expect(transitionComplaint(c.id, t.student, "REJECTED", { rejectionReason: "x".repeat(10) }).ok).toBe(false);
    transitionComplaint(c.id, t.admin, "UNDER_REVIEW");
    const noReason = transitionComplaint(c.id, t.admin, "REJECTED");
    expect(noReason.ok).toBe(false);
    const ok = transitionComplaint(c.id, t.admin, "REJECTED", { rejectionReason: "Duplicate ticket" });
    expect(ok.ok).toBe(true);
    expect(getComplaint(c.id)!.rejectionReason).toBe("Duplicate ticket");
  });

  it("blocks unauthorized status changes (wrong role / wrong technician / wrong student)", () => {
    const t = setup();
    const c = t.newComplaint();
    transitionComplaint(c.id, t.admin, "UNDER_REVIEW");
    transitionComplaint(c.id, t.admin, "ASSIGNED", { assigneeId: t.tech.id });
    expect(transitionComplaint(c.id, t.student, "ACCEPTED").ok).toBe(false);
    expect(transitionComplaint(c.id, t.tech2, "ACCEPTED").ok).toBe(false); // not the assignee
    expect(transitionComplaint(c.id, t.tech, "ACCEPTED").ok).toBe(true);
    transitionComplaint(c.id, t.tech, "IN_PROGRESS");
    transitionComplaint(c.id, t.tech, "READY_FOR_VERIFICATION");
    expect(transitionComplaint(c.id, t.student2, "RESOLVED").ok).toBe(false); // not the reporter
    expect(transitionComplaint(c.id, t.tech, "RESOLVED").ok).toBe(false); // tech cannot self-verify
    expect(transitionComplaint(c.id, t.student, "RESOLVED").ok).toBe(true);
  });

  it("technician can decline an assignment, returning it to review", () => {
    const t = setup();
    const c = t.newComplaint();
    transitionComplaint(c.id, t.admin, "UNDER_REVIEW");
    transitionComplaint(c.id, t.admin, "ASSIGNED", { assigneeId: t.tech.id });
    recordAssignment(c.id, t.tech.id, t.admin.id);
    const r = transitionComplaint(c.id, t.tech, "UNDER_REVIEW", { assigneeId: null });
    expect(r.ok).toBe(true);
    expect(getComplaint(c.id)!.assigneeId).toBeNull();
  });
});

describe("reopen workflow", () => {
  it("lets the reporting student reopen a resolved complaint, clearing resolution date", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    const r = transitionComplaint(c.id, t.student, "REOPENED", { comment: "Still broken" });
    expect(r.ok).toBe(true);
    const after = getComplaint(c.id)!;
    expect(after.status).toBe("REOPENED");
    expect(after.resolutionDate).toBeNull();
    expect(listActivity(c.id).at(-1)?.comment).toBe("Still broken");
    expect(listNotifications(t.tech.id).some((n) => n.type === "REOPENED")).toBe(true);
  });
  it("does not let another student reopen it", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    expect(transitionComplaint(c.id, t.student2, "REOPENED").ok).toBe(false);
  });
  it("cannot reopen a complaint that is not resolved/closed", () => {
    const t = setup();
    const c = t.newComplaint();
    expect(transitionComplaint(c.id, t.student, "REOPENED").ok).toBe(false);
  });
});

describe("SLA check & escalation", () => {
  it("flags overdue active complaints, escalates once, and notifies", () => {
    const t = setup();
    const c = t.newComplaint("HIGH");
    getDb()
      .prepare("UPDATE Complaint SET slaDeadline = ? WHERE id = ?")
      .run(new Date(Date.now() - 3600_000).toISOString(), c.id);
    expect(isOverdue(getComplaint(c.id)!)).toBe(true);

    const first = runSlaCheck(t.admin.id);
    expect(first.escalated).toBe(1);
    expect(getComplaint(c.id)!.escalated).toBe(1);
    expect(listNotifications(t.student.id).some((n) => n.type === "SLA_OVERDUE")).toBe(true);
    expect(runSlaCheck(t.admin.id).escalated).toBe(0); // idempotent
  });
  it("sends a 'nearing deadline' notification inside the last 20% of the window", () => {
    const t = setup();
    const c = t.newComplaint("HIGH");
    getDb()
      .prepare("UPDATE Complaint SET createdAt = ?, slaDeadline = ? WHERE id = ?")
      .run(new Date(Date.now() - 23 * 3600_000).toISOString(), new Date(Date.now() + 1 * 3600_000).toISOString(), c.id);
    expect(runSlaCheck(t.admin.id).nearing).toBe(1);
    expect(listNotifications(t.student.id).some((n) => n.type === "SLA_NEARING")).toBe(true);
  });
  it("does not escalate resolved complaints", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    getDb()
      .prepare("UPDATE Complaint SET slaDeadline = ? WHERE id = ?")
      .run(new Date(Date.now() - 1000).toISOString(), c.id);
    expect(runSlaCheck(t.admin.id).escalated).toBe(0);
  });
});

describe("filters, ratings and analytics", () => {
  it("filters by status and reporter", () => {
    const t = setup();
    t.newComplaint("LOW");
    t.newComplaint("HIGH", t.student2.id);
    expect(listComplaints({ reporterId: t.student.id })).toHaveLength(1);
    expect(listComplaints({ priority: "HIGH" })).toHaveLength(1);
    expect(listComplaints({ status: "CLOSED" })).toHaveLength(0);
  });
  it("allows only one rating per complaint and feeds satisfaction score", () => {
    const t = setup();
    const c = t.newComplaint();
    fullResolve(t, c.id);
    addRating(c.id, t.student.id, 4, "Good");
    expect(() => addRating(c.id, t.student.id, 5)).toThrow();
    expect(adminOverview().satisfaction).toBe(4);
    expect(adminOverview().resolutionRate).toBe(100);
  });
  it("public stats expose only aggregates (no identities or text)", () => {
    const t = setup();
    t.newComplaint();
    const json = JSON.stringify(publicStats());
    expect(json).not.toContain("Student One");
    expect(json).not.toContain("Broken fan");
  });
});
