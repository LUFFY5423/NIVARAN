import { getDb } from "@/server/db/client";
import type { ComplaintRow, ComplaintStatus } from "@/lib/types";
import { isOverdue } from "@/server/repo/complaints";

const CLOSED_STATUSES: ComplaintStatus[] = ["RESOLVED", "CLOSED"];
const OPEN_STATUSES: ComplaintStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "READY_FOR_VERIFICATION",
  "REOPENED",
];

export function adminOverview() {
  const db = getDb();
  const all = db.prepare("SELECT * FROM Complaint").all() as ComplaintRow[];

  const total = all.length;
  const open = all.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const resolved = all.filter((c) => CLOSED_STATUSES.includes(c.status)).length;
  const overdue = all.filter(isOverdue).length;

  const resolvedWithDates = all.filter((c) => c.resolutionDate);
  const avgResolutionHours = resolvedWithDates.length
    ? resolvedWithDates.reduce((sum, c) => {
        const created = new Date(c.createdAt).getTime();
        const resolvedAt = new Date(c.resolutionDate!).getTime();
        return sum + (resolvedAt - created) / 3600000;
      }, 0) / resolvedWithDates.length
    : 0;

  const resolutionRate = total ? Math.round((resolved / total) * 1000) / 10 : 0;

  const byCategory = groupCount(all, (c) => c.categoryId);
  const byPriority = groupCount(all, (c) => c.priority);
  const byBlock = groupCount(
    all.filter((c) => c.blockId),
    (c) => c.blockId as string
  );

  const monthlyTrend = monthlyBuckets(all);

  const byAssignee = groupCount(
    all.filter((c) => c.assigneeId),
    (c) => c.assigneeId as string
  );

  const ratings = db.prepare("SELECT score FROM Rating").all() as { score: number }[];
  const satisfaction = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 10) / 10
    : null;

  return {
    total,
    open,
    resolved,
    overdue,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    resolutionRate,
    byCategory,
    byPriority,
    byBlock,
    monthlyTrend,
    byAssignee,
    satisfaction,
  };
}

export function technicianOverview(technicianId: string) {
  const db = getDb();
  const assigned = db.prepare("SELECT * FROM Complaint WHERE assigneeId = ?").all(technicianId) as ComplaintRow[];

  const active = assigned.filter((c) => OPEN_STATUSES.includes(c.status));
  const urgent = active.filter((c) => c.priority === "EMERGENCY" || c.priority === "HIGH");
  const overdue = active.filter(isOverdue);
  const completed = assigned.filter((c) => CLOSED_STATUSES.includes(c.status));
  const recent = [...assigned].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5);

  return { assignedCount: assigned.length, active, urgent, overdue, completed, recent };
}

export function studentOverview(studentId: string) {
  const db = getDb();
  const mine = db
    .prepare("SELECT * FROM Complaint WHERE reporterId = ? ORDER BY createdAt DESC")
    .all(studentId) as ComplaintRow[];

  const open = mine.filter((c) => OPEN_STATUSES.includes(c.status) && c.status !== "REOPENED");
  const resolved = mine.filter((c) => CLOSED_STATUSES.includes(c.status));
  const reopened = mine.filter((c) => c.status === "REOPENED");

  return { total: mine.length, open, resolved, reopened, recent: mine.slice(0, 5) };
}

/** Public, anonymized stats: aggregate counts only, no student identity or free-text. */
export function publicStats() {
  const db = getDb();
  const all = db.prepare("SELECT * FROM Complaint").all() as ComplaintRow[];
  const total = all.length;
  const resolved = all.filter((c) => CLOSED_STATUSES.includes(c.status)).length;
  const resolutionRate = total ? Math.round((resolved / total) * 1000) / 10 : 0;
  const resolvedWithDates = all.filter((c) => c.resolutionDate);
  const avgResolutionHours = resolvedWithDates.length
    ? Math.round(
        (resolvedWithDates.reduce((sum, c) => {
          const created = new Date(c.createdAt).getTime();
          const resolvedAt = new Date(c.resolutionDate!).getTime();
          return sum + (resolvedAt - created) / 3600000;
        }, 0) /
          resolvedWithDates.length) *
          10
      ) / 10
    : null;
  const byCategory = groupCount(all, (c) => c.categoryId);
  const monthlyTrend = monthlyBuckets(all);
  const ratings = db.prepare("SELECT score FROM Rating").all() as { score: number }[];
  const satisfaction = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 10) / 10
    : null;

  return { total, resolutionRate, avgResolutionHours, byCategory, monthlyTrend, satisfaction };
}

function groupCount<T>(rows: T[], keyFn: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function monthlyBuckets(rows: ComplaintRow[]): { month: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const row of rows) {
    const d = new Date(row.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, count]) => ({ month, count }));
}
