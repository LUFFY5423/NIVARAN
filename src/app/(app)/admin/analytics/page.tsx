import { query } from "@/server/db/client";
import { adminOverview } from "@/server/repo/analytics";
import { listCategories, listUsers } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { SimpleLineChart } from "@/components/charts/line-chart";
import { isOverdue } from "@/server/repo/complaints";
import type { ComplaintRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const o = await adminOverview();
  const all = await query<ComplaintRow>(`SELECT * FROM "Complaint"`);
  const cats = new Map((await listCategories()).map((c) => [c.id, c.name]));
  const users = new Map((await listUsers()).map((u) => [u.id, u.name]));

  const sums: Record<string, { total: number; n: number }> = {};
  for (const c of all) {
    if (!c.resolutionDate) continue;
    const h = (new Date(c.resolutionDate).getTime() - new Date(c.createdAt).getTime()) / 3600000;
    (sums[c.categoryId] ??= { total: 0, n: 0 }).total += h;
    sums[c.categoryId].n += 1;
  }
  const avgByCat = Object.entries(sums).map(([id, s]) => ({
    label: cats.get(id) ?? id,
    value: Math.round((s.total / s.n) * 10) / 10,
  }));

  const overdueBy: Record<string, number> = {};
  for (const c of all.filter(isOverdue)) {
    const key = c.assigneeId ? (users.get(c.assigneeId) ?? "?") : "Unassigned";
    overdueBy[key] = (overdueBy[key] ?? 0) + 1;
  }
  const overdueData = Object.entries(overdueBy).map(([label, value]) => ({ label, value }));

  const ratings = await query<{ score: number; c: string }>(
    `SELECT score, COUNT(*)::text AS c FROM "Rating" GROUP BY score ORDER BY score`
  );
  const ratingData = ratings.map((r) => ({ label: `${r.score}★`, value: Number(r.c) }));

  const stat = (label: string, value: string | number, red = false) => (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`font-display text-4xl font-semibold ${red ? "text-red-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Analytics" description="Resolution speed, accountability and satisfaction." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stat("Resolution rate", `${o.resolutionRate}%`)}
        {stat("Avg resolution (h)", o.avgResolutionHours)}
        {stat("Overdue now", o.overdue, true)}
        {stat("Satisfaction", o.satisfaction ?? "—")}
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avg resolution hours by category</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={avgByCat} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue complaints by technician</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={overdueData} color="#dc2626" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rating distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={ratingData} color="#3aa86b" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly complaint trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={o.monthlyTrend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
