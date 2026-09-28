import { describe, it, expect, vi } from "vitest";
import { setup } from "./helpers";

let currentSession: unknown = null;
vi.mock("@/server/auth", () => ({ getSession: async () => currentSession }));

describe("CSV export route", () => {
  it("returns 401 without session and 403 for non-admins", async () => {
    const { GET } = await import("@/app/api/export/complaints/route");
    currentSession = null;
    expect((await GET(new Request("http://x/api/export/complaints"))).status).toBe(401);
    const t = setup();
    currentSession = t.student;
    expect((await GET(new Request("http://x/api/export/complaints"))).status).toBe(403);
  });
  it("exports filtered CSV for admins, with safe escaping", async () => {
    const { GET } = await import("@/app/api/export/complaints/route");
    const t = setup();
    t.newComplaint("HIGH");
    t.newComplaint("LOW");
    currentSession = t.admin;
    const res = await GET(new Request("http://x/api/export/complaints?priority=HIGH"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toContain("Title");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("HIGH");
  });
});
