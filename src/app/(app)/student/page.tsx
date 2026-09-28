import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { getSession } from "@/server/auth";
import { studentOverview } from "@/server/repo/analytics";
import { listCategories } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/status-badges";
import { isOverdue } from "@/server/repo/complaints";
import { formatDate } from "@/lib/utils";

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) return null;
  const overview = studentOverview(session.id);
  const categories = listCategories();
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.name.split(" ")[0]}`}
        description="Track your complaints and report new issues here."
        action={
          <Link href="/student/submit">
            <Button>
              <FilePlus2 size={16} /> Submit Complaint
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Open" value={overview.open.length} />
        <StatCard label="Resolved" value={overview.resolved.length} />
        <StatCard label="Reopened" value={overview.reopened.length} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recent.length === 0 ? (
            <EmptyState
              title="No complaints yet"
              description="Submit your first complaint to start tracking it here."
              action={
                <Link href="/student/submit">
                  <Button size="sm">Submit Complaint</Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/complaints/${c.id}`}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      {categoryName(c.categoryId)} · {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue(c) && <OverdueBadge />}
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
