import { describe, it, expect } from "vitest";
import { isPastDeadline, computeDeadline, slaCountdown } from "@/lib/sla";
import { toCsv, csvCell } from "@/lib/csv";
import { canViewComplaint, canActorSetStatus } from "@/lib/permissions";
import { STATUS_TRANSITIONS } from "@/lib/types";
import { complaintSchema, registerSchema, validateUploadedFile } from "@/lib/validation";

describe("SLA overdue calculation", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  it("is overdue when deadline passed and complaint still active", () => {
    expect(isPastDeadline("IN_PROGRESS", "2026-01-10T11:00:00Z", now)).toBe(true);
  });
  it("is not overdue before the deadline", () => {
    expect(isPastDeadline("ASSIGNED", "2026-01-10T13:00:00Z", now)).toBe(false);
  });
  it("finished complaints are never overdue", () => {
    for (const s of ["RESOLVED", "CLOSED", "REJECTED"] as const) {
      expect(isPastDeadline(s, "2026-01-01T00:00:00Z", now)).toBe(false);
    }
  });
  it("computes deadline and countdown text", () => {
    expect(computeDeadline(24, now)).toBe("2026-01-11T12:00:00.000Z");
    expect(slaCountdown("2026-01-10T14:30:00Z", now)).toBe("2h 30m left");
    expect(slaCountdown("2026-01-10T10:00:00Z", now)).toBe("Overdue by 2h 0m");
  });
});

describe("CSV export helpers", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("neutralizes formula injection", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe("'+1");
  });
  it("builds header + rows with CRLF", () => {
    expect(toCsv(["A", "B"], [[1, "x"]])).toBe("A,B\r\n1,x\r\n");
  });
});

describe("permissions", () => {
  const c = { reporterId: "s1", assigneeId: "t1" };
  it("students only see their own complaints", () => {
    expect(canViewComplaint({ id: "s1", role: "STUDENT" }, c)).toBe(true);
    expect(canViewComplaint({ id: "s2", role: "STUDENT" }, c)).toBe(false);
  });
  it("technicians only see assigned complaints", () => {
    expect(canViewComplaint({ id: "t1", role: "TECHNICIAN" }, c)).toBe(true);
    expect(canViewComplaint({ id: "t2", role: "TECHNICIAN" }, c)).toBe(false);
  });
  it("admins see everything", () => expect(canViewComplaint({ id: "a", role: "ADMIN" }, c)).toBe(true));
  it("students cannot set technician statuses", () => {
    expect(canActorSetStatus({ id: "s1", role: "STUDENT" }, "IN_PROGRESS", c)).toBe(true); // rejecting a fix
    expect(canActorSetStatus({ id: "s1", role: "STUDENT" }, "READY_FOR_VERIFICATION", c)).toBe(false);
    expect(canActorSetStatus({ id: "s1", role: "STUDENT" }, "ASSIGNED", c)).toBe(false);
  });
});

describe("lifecycle table", () => {
  it("REJECTED is terminal and RESOLVED can be reopened", () => {
    expect(STATUS_TRANSITIONS.REJECTED).toEqual([]);
    expect(STATUS_TRANSITIONS.RESOLVED).toContain("REOPENED");
  });
});

describe("validation", () => {
  it("rejects short titles and bad priority", () => {
    expect(
      complaintSchema.safeParse({ title: "hi", description: "long enough text", categoryId: "c", priority: "HIGH" })
        .success
    ).toBe(false);
    expect(
      complaintSchema.safeParse({
        title: "Valid title",
        description: "long enough text",
        categoryId: "c",
        priority: "URGENT",
      }).success
    ).toBe(false);
  });
  it("rejects weak registration", () => {
    expect(registerSchema.safeParse({ name: "Al", email: "bad", password: "123" }).success).toBe(false);
  });
  it("validates upload type and size", () => {
    const bad = new File(["x"], "a.exe", { type: "application/x-msdownload" });
    expect(validateUploadedFile(bad)).toMatch(/Only/);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "a.png", { type: "image/png" });
    expect(validateUploadedFile(big)).toMatch(/too large/);
    expect(validateUploadedFile(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
  });
});
