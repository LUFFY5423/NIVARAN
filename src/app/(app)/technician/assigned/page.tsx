import { getSession } from "@/server/auth";
import { listComplaints } from "@/server/repo/complaints";
import { listCategories, listUsers } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { ComplaintTable } from "@/components/complaints/complaint-table";
import { STATUS_LABELS } from "@/lib/types";
import type { ComplaintStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AssignedPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;
  const complaints = listComplaints({ assigneeId: session.id, status: (status as ComplaintStatus) || undefined });
  const cats = new Map(listCategories().map((c) => [c.id, c.name]));
  const users = new Map(listUsers().map((u) => [u.id, u.name]));

  const pills: [string, string][] = [["", "All"], ...(Object.entries(STATUS_LABELS) as [string, string][])];

  return (
    <div>
      <PageHeader
        title="Assigned complaints"
        description="Open a complaint to accept, start work, or submit resolution evidence."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {pills.map(([k, label]) => (
          <a
            key={k || "all"}
            href={k ? `/technician/assigned?status=${k}` : "/technician/assigned"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              (status ?? "") === k
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
      <ComplaintTable
        complaints={complaints}
        categoryName={(id) => cats.get(id) ?? "—"}
        showReporterCol
        reporterName={(id) => users.get(id) ?? "—"}
        emptyTitle="Nothing assigned in this view"
      />
    </div>
  );
}
