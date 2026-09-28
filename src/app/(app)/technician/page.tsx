import Link from "next/link";
import { getSession } from "@/server/auth";
import { technicianOverview } from "@/server/repo/analytics";
import { listCategories, listBlocks, listRooms } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/status-badges";
import { isOverdue } from "@/server/repo/complaints";
import { slaCountdown } from "@/lib/sla";
import type { ComplaintRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TechnicianDashboard() {
  const session = await getSession();
  if (!session) return null;
  const o = technicianOverview(session.id);
  const cats = new Map(listCategories().map((c) => [c.id, c.name]));
  const blocks = new Map(listBlocks().map((b) => [b.id, b.name]));
  const rooms = new Map(listRooms().map((r) => [r.id, r.number]));

  const location = (c: ComplaintRow) =>
    [c.blockId ? blocks.get(c.blockId) : null, c.roomId ? `Room ${rooms.get(c.roomId)}` : null]
      .filter(Boolean)
      .join(" · ") || "Location not given";

  const List = ({ items, empty }: { items: ComplaintRow[]; empty: string }) =>
    items.length === 0 ? (
      <EmptyState title={empty} />
    ) : (
      <div className="divide-y divide-slate-100">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/complaints/${c.id}`}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">{c.title}</p>
              <p className="text-xs text-slate-400">
                {cats.get(c.categoryId)} · {location(c)} · {slaCountdown(c.slaDeadline)}
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
    );

  return (
    <div>
      <PageHeader title="Technician dashboard" description="Your queue, sorted by what needs attention." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Active", o.active.length, false],
          ["Urgent", o.urgent.length, o.urgent.length > 0],
          ["Overdue", o.overdue.length, o.overdue.length > 0],
          ["Completed", o.completed.length, false],
        ].map(([label, value, red]) => (
          <Card key={String(label)}>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`text-2xl font-bold ${red ? "text-red-600" : "text-slate-900"}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Urgent (High &amp; Emergency)</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={o.urgent} empty="Nothing urgent right now" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={o.overdue} empty="No overdue complaints" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recently updated</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={o.recent} empty="No assignments yet" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
