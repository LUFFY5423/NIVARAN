import Link from "next/link";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { isOverdue } from "@/server/repo/complaints";
import type { ComplaintRow } from "@/lib/types";

export function ComplaintTable({
  complaints,
  categoryName,
  emptyTitle = "No complaints found",
  emptyDescription = "Try adjusting your filters.",
  showReporterCol = false,
  reporterName,
  showAssigneeCol = false,
  assigneeName,
}: {
  complaints: ComplaintRow[];
  categoryName: (id: string) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  showReporterCol?: boolean;
  reporterName?: (id: string) => string;
  showAssigneeCol?: boolean;
  assigneeName?: (id: string | null) => string;
}) {
  if (complaints.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Category</th>
            {showReporterCol && <th className="px-4 py-3">Reporter</th>}
            {showAssigneeCol && <th className="px-4 py-3">Assignee</th>}
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/complaints/${c.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                  {c.title}
                </Link>
                {isOverdue(c) && (
                  <div className="mt-1">
                    <OverdueBadge />
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">{categoryName(c.categoryId)}</td>
              {showReporterCol && <td className="px-4 py-3 text-slate-500">{reporterName?.(c.reporterId) ?? "—"}</td>}
              {showAssigneeCol && (
                <td className="px-4 py-3 text-slate-500">{assigneeName?.(c.assigneeId) ?? "Unassigned"}</td>
              )}
              <td className="px-4 py-3">
                <PriorityBadge priority={c.priority} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
