import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { setup } from "./helpers";
import type { SessionUser } from "@/lib/types";

// --- Test doubles for Next.js runtime APIs ---
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (cookieJar.has(k) ? { value: cookieJar.get(k) } : undefined),
    set: (k: string, v: string) => void cookieJar.set(k, v),
    delete: (k: string) => void cookieJar.delete(k),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

process.env.UPLOAD_DIR = "tests/.tmp-uploads";
afterAll(() => fs.rmSync(path.join(process.cwd(), "tests/.tmp-uploads"), { recursive: true, force: true }));

// getSession is driven by the cookie the real login action sets, so login is truly exercised
async function actAs(fn: () => Promise<void>) {
  await fn();
}
const fd = (o: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => cookieJar.clear());

describe("login / register actions", () => {
  it("logs in with correct credentials and sets an httpOnly session cookie", async () => {
    const { hashPassword, getSession } = await import("@/server/auth");
    const { createUser } = await import("@/server/repo/reference-data");
    const { loginAction } = await import("@/server/actions/auth");
    createUser({
      name: "Login User",
      email: "lu@test.dev",
      passwordHash: await hashPassword("Password123!"),
      role: "STUDENT",
    });

    expect((await loginAction(fd({ email: "LU@test.dev", password: "Password123!" }))).ok).toBe(true);
    expect((await getSession())?.email).toBe("lu@test.dev");
  });

  it("gives the same generic error for unknown email and wrong password", async () => {
    const { hashPassword } = await import("@/server/auth");
    const { createUser } = await import("@/server/repo/reference-data");
    const { loginAction } = await import("@/server/actions/auth");
    createUser({ name: "X", email: "x@test.dev", passwordHash: await hashPassword("Password123!"), role: "STUDENT" });
    const a = await loginAction(fd({ email: "x@test.dev", password: "nope" }));
    const b = await loginAction(fd({ email: "ghost@test.dev", password: "nope" }));
    expect(a).toEqual(b);
    expect(a.ok).toBe(false);
    expect(cookieJar.size).toBe(0);
  });

  it("invalidates an existing session as soon as the account is deactivated", async () => {
    const { hashPassword, getSession } = await import("@/server/auth");
    const { createUser, updateUser } = await import("@/server/repo/reference-data");
    const { loginAction } = await import("@/server/actions/auth");
    const u = createUser({
      name: "Live",
      email: "live@test.dev",
      passwordHash: await hashPassword("Password123!"),
      role: "STUDENT",
    });
    await loginAction(fd({ email: "live@test.dev", password: "Password123!" }));
    expect((await getSession())?.id).toBe(u.id);
    updateUser(u.id, { isActive: 0 });
    expect(await getSession()).toBeNull();
  });

  it("refuses deactivated accounts", async () => {
    const { hashPassword } = await import("@/server/auth");
    const { createUser, updateUser } = await import("@/server/repo/reference-data");
    const { loginAction } = await import("@/server/actions/auth");
    const u = createUser({
      name: "Off",
      email: "off@test.dev",
      passwordHash: await hashPassword("Password123!"),
      role: "STUDENT",
    });
    updateUser(u.id, { isActive: 0 });
    expect((await loginAction(fd({ email: "off@test.dev", password: "Password123!" }))).ok).toBe(false);
  });

  it("registers students only as STUDENT, hashes password, and rejects duplicates / weak input", async () => {
    const { registerStudentAction } = await import("@/server/actions/auth");
    const { findUserByEmail } = await import("@/server/repo/reference-data");
    expect(
      (
        await registerStudentAction(
          fd({ name: "New Student", email: "new@test.dev", password: "Password123!", role: "ADMIN" })
        )
      ).ok
    ).toBe(true);
    const u = findUserByEmail("new@test.dev")!;
    expect(u.role).toBe("STUDENT"); // a posted "role" field can never elevate privileges
    expect(u.passwordHash).not.toContain("Password123!");
    expect((await registerStudentAction(fd({ name: "Dup", email: "new@test.dev", password: "Password123!" }))).ok).toBe(
      false
    );
    expect((await registerStudentAction(fd({ name: "Weak", email: "weak@test.dev", password: "123" }))).ok).toBe(false);
  });
});

describe("critical workflow: student submits -> admin assigns -> technician resolves -> student verifies/reopens", () => {
  async function loginAs(u: SessionUser) {
    const { hashPassword, setSessionCookie } = await import("@/server/auth");
    void hashPassword;
    await setSessionCookie(u);
  }

  it("runs end to end through the real server actions, enforcing authorization at every step", async () => {
    const t = setup();
    const A = await import("@/server/actions/complaints");
    const { getComplaint, listAttachments, listActivity, getRating } = await import("@/server/repo/complaints");
    const { listNotifications } = await import("@/server/repo/notifications");

    // 1. Student submits with photo evidence
    await loginAs(t.student);
    const png = new File([new Uint8Array([137, 80, 78, 71])], "fan.png", { type: "image/png" });
    let r = await A.submitComplaintAction(
      fd({
        title: "Fan is broken",
        description: "Fan makes noise and stopped",
        categoryId: t.cat.id,
        blockId: t.block.id,
        roomId: t.room.id,
        priority: "HIGH",
        evidence: png,
      })
    );
    expect(r.ok).toBe(true);
    const c = (await import("@/server/repo/complaints")).listComplaints({ reporterId: t.student.id })[0];
    expect(c.status).toBe("SUBMITTED");
    expect(listAttachments(c.id)).toHaveLength(1);
    expect(
      fs.existsSync(path.join(process.cwd(), "tests/.tmp-uploads", path.basename(listAttachments(c.id)[0].filePath)))
    ).toBe(true);

    // bad upload is rejected
    const exe = new File(["MZ"], "virus.exe", { type: "application/x-msdownload" });
    expect(
      (
        await A.submitComplaintAction(
          fd({
            title: "Another problem",
            description: "Something else broke",
            categoryId: t.cat.id,
            priority: "LOW",
            evidence: exe,
          })
        )
      ).ok
    ).toBe(false);

    // 2. Student cannot assign, and a technician cannot assign either
    expect((await A.assignComplaintAction(fd({ complaintId: c.id, technicianId: t.tech.id }))).ok).toBe(false);
    await loginAs(t.tech);
    expect((await A.assignComplaintAction(fd({ complaintId: c.id, technicianId: t.tech.id }))).ok).toBe(false);

    // 3. Admin assigns (auto-advances through UNDER_REVIEW)
    await loginAs(t.admin);
    expect(
      (await A.assignComplaintAction(fd({ complaintId: c.id, technicianId: t.tech.id, note: "Please check today" }))).ok
    ).toBe(true);
    expect(getComplaint(c.id)!.status).toBe("ASSIGNED");
    expect(listNotifications(t.tech.id).some((n) => n.type === "COMPLAINT_ASSIGNED")).toBe(true);

    // 4. Wrong technician cannot accept; right one can
    await loginAs(t.tech2);
    expect((await A.technicianRespondAssignmentAction(c.id, true)).ok).toBe(false);
    await loginAs(t.tech);
    expect((await A.technicianRespondAssignmentAction(c.id, true)).ok).toBe(true);
    expect((await A.startWorkAction(c.id)).ok).toBe(true);

    // 5. Technician must describe the work; uploads resolution evidence
    expect((await A.markReadyForVerificationAction(fd({ complaintId: c.id, resolutionNotes: "" }))).ok).toBe(false);
    const after = new File([new Uint8Array([137, 80, 78, 71])], "after.png", { type: "image/png" });
    expect(
      (
        await A.markReadyForVerificationAction(
          fd({ complaintId: c.id, resolutionNotes: "Replaced the capacitor", resolutionEvidence: after })
        )
      ).ok
    ).toBe(true);
    expect(
      listAttachments(c.id)
        .map((a) => a.kind)
        .sort()
    ).toEqual(["EVIDENCE", "RESOLUTION"]); // before & after
    expect(listNotifications(t.student.id).some((n) => n.type === "READY_FOR_VERIFICATION")).toBe(true);

    // 6. Another student cannot confirm; the reporter can
    await loginAs(t.student2);
    expect((await A.studentConfirmResolutionAction(c.id)).ok).toBe(false);
    await loginAs(t.student);
    expect((await A.studentConfirmResolutionAction(c.id)).ok).toBe(true);
    expect(getComplaint(c.id)!.status).toBe("RESOLVED");

    // 7. Rating: valid once, not twice, and out-of-range rejected
    expect((await A.rateComplaintAction(fd({ complaintId: c.id, score: "9" }))).ok).toBe(false);
    expect((await A.rateComplaintAction(fd({ complaintId: c.id, score: "5", feedback: "Quick fix" }))).ok).toBe(true);
    expect((await A.rateComplaintAction(fd({ complaintId: c.id, score: "1" }))).ok).toBe(false);
    expect(getRating(c.id)?.score).toBe(5);

    // 8. Student reopens after resolution
    expect((await A.studentReopenAction(fd({ complaintId: c.id, reason: "Broke again" }))).ok).toBe(true);
    expect(getComplaint(c.id)!.status).toBe("REOPENED");

    // 9. Timeline holds the full history with the reopen comment
    const log = listActivity(c.id);
    expect(log.map((l) => l.newStatus)).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "ASSIGNED",
      "ACCEPTED",
      "IN_PROGRESS",
      "READY_FOR_VERIFICATION",
      "RESOLVED",
      "REOPENED",
    ]);
    expect(log.at(-1)?.comment).toBe("Broke again");
  });

  it("admin override close requires a recorded reason and is audited", async () => {
    const t = setup();
    const A = await import("@/server/actions/complaints");
    const { getComplaint, listActivity } = await import("@/server/repo/complaints");
    const { getDb } = await import("@/server/db/client");
    const c = t.newComplaint();

    await loginAs(t.student);
    expect((await A.adminOverrideCloseAction(fd({ complaintId: c.id, reason: "because" }))).ok).toBe(false);
    await loginAs(t.admin);
    expect((await A.adminOverrideCloseAction(fd({ complaintId: c.id, reason: "" }))).ok).toBe(false);
    expect(
      (
        await A.adminOverrideCloseAction(
          fd({ complaintId: c.id, reason: "Student left campus; work verified by warden" })
        )
      ).ok
    ).toBe(true);
    expect(getComplaint(c.id)!.status).toBe("CLOSED");
    expect(listActivity(c.id).at(-1)?.comment).toContain("Administrator override");
    expect(getDb().prepare("SELECT * FROM AuditLog WHERE action='ADMIN_OVERRIDE_CLOSE'").all()).toHaveLength(1);
  });

  it("students cannot view or comment on another student's complaint, and cannot post internal notes", async () => {
    const t = setup();
    const A = await import("@/server/actions/complaints");
    const { listComments } = await import("@/server/repo/complaints");
    const c = t.newComplaint();
    await loginAs(t.student2);
    expect((await A.addCommentAction(fd({ complaintId: c.id, body: "snooping" }))).ok).toBe(false);
    await loginAs(t.student);
    expect((await A.addCommentAction(fd({ complaintId: c.id, body: "hello", isInternal: "true" }))).ok).toBe(true);
    expect(listComments(c.id, false)).toHaveLength(1); // internal flag ignored for students
    await loginAs(t.admin);
    await A.addCommentAction(fd({ complaintId: c.id, body: "staff only", isInternal: "true" }));
    expect(listComments(c.id, false).map((x) => x.body)).not.toContain("staff only");
    expect(listComments(c.id, true).map((x) => x.body)).toContain("staff only");
  });
});
