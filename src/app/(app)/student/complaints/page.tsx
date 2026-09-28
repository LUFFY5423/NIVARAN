import { getSession } from "@/server/auth";
import { listComplaints } from "@/server/repo/complaints";
import { listCategories } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { ComplaintTable } from "@/components/complaints/complaint-table";
import { STATUS_LABELS } from "@/lib/types";
import type { ComplaintStatus } from "@/lib/types";

export default async function MyComplaintsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;

  const complaints = listComplaints({
    reporterId: session.id,
    status: (status as ComplaintStatus) || undefined,
  });
  const categories = listCategories();
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const statusEntries = Object.entries(STATUS_LABELS) as [ComplaintStatus, string][];

  return (
    <div>
      <PageHeader title="My Complaints" description="All complaints you've submitted, with live status." />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill href="/student/complaints" active={!status} label="All" />
        {statusEntries.map(([key, label]) => (
          <FilterPill key={key} href={`/student/complaints?status=${key}`} active={status === key} label={label} />
        ))}
      </div>

      <ComplaintTable
        complaints={complaints}
        categoryName={categoryName}
        emptyTitle="No complaints in this view"
        emptyDescription="Try a different filter, or submit a new complaint."
      />
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </a>
  );
}
