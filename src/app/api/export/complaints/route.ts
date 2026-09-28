import { NextResponse } from "next/server";
import { getSession } from "@/server/auth";
import { listComplaints } from "@/server/repo/complaints";
import { listCategories, listBlocks, listRooms, listUsers } from "@/server/repo/reference-data";
import { writeAudit } from "@/server/repo/audit";
import { toCsv } from "@/lib/csv";
import type { ComplaintStatus, Priority } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const complaints = listComplaints({
    status: (sp.get("status") as ComplaintStatus) || undefined,
    category: sp.get("category") || undefined,
    priority: (sp.get("priority") as Priority) || undefined,
    blockId: sp.get("block") || undefined,
    assigneeId: sp.get("assignee") || undefined,
    dateFrom: sp.get("from") || undefined,
    dateTo: sp.get("to") ? `${sp.get("to")}T23:59:59.999Z` : undefined,
  });

  const cats = new Map(listCategories().map((c) => [c.id, c.name]));
  const blocks = new Map(listBlocks().map((b) => [b.id, b.name]));
  const rooms = new Map(listRooms().map((r) => [r.id, r.number]));
  const users = new Map(listUsers().map((u) => [u.id, u.name]));

  const csv = toCsv(
    [
      "ID",
      "Title",
      "Category",
      "Block",
      "Room",
      "Priority",
      "Status",
      "Reporter",
      "Assignee",
      "Created",
      "SLA Deadline",
      "Resolved",
      "Escalated",
    ],
    complaints.map((c) => [
      c.id,
      c.title,
      cats.get(c.categoryId) ?? "",
      c.blockId ? (blocks.get(c.blockId) ?? "") : "",
      c.roomId ? (rooms.get(c.roomId) ?? "") : "",
      c.priority,
      c.status,
      users.get(c.reporterId) ?? "",
      c.assigneeId ? (users.get(c.assigneeId) ?? "") : "",
      c.createdAt,
      c.slaDeadline ?? "",
      c.resolutionDate ?? "",
      c.escalated ? "yes" : "no",
    ])
  );

  writeAudit(session.id, "CSV_EXPORT", "Complaint", null, { rows: complaints.length });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nivaran-complaints-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
