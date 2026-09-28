import { adminOverview } from "@/server/repo/analytics";
import { listCategories, listBlocks, listUsers } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { SimpleLineChart } from "@/components/charts/line-chart";
import { SlaCheckButton } from "@/components/admin/sla-check-button";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const o = adminOverview();
  const cats = new Map(listCategories().map((c) => [c.id, c.name]));
  const blocks = new Map(listBlocks().map((b) => [b.id, b.name]));
  const users = new Map(listUsers().map((u) => [u.id, u.name]));

  const toData = (rec: Record<string, number>, names?: Map<string, string>) =>
    Object.entries(rec).map(([k, v]) => ({ label: names?.get(k) ?? k, value: v }));

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        description="Live overview of complaint handling performance."
        action={<SlaCheckButton />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Total complaints" value={o.total} />
        <Kpi label="Open" value={o.open} />
        <Kpi label="Resolved" value={o.resolved} />
        <Kpi label="Overdue" value={o.overdue} tone={o.overdue > 0 ? "red" : undefined} />
        <Kpi label="Avg resolution time" value={`${o.avgResolutionHours}h`} />
        <Kpi label="Resolution rate" value={`${o.resolutionRate}%`} />
        <Kpi label="Satisfaction (1–5)" value={o.satisfaction ?? "—"} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ChartCard title="Complaints by category">
          <SimpleBarChart data={toData(o.byCategory, cats)} />
        </ChartCard>
        <ChartCard title="Complaints by hostel block">
          <SimpleBarChart data={toData(o.byBlock, blocks)} color="#ef7f0f" />
        </ChartCard>
        <ChartCard title="Complaints by priority">
          <SimpleBarChart data={toData(o.byPriority)} color="#af450c" />
        </ChartCard>
        <ChartCard title="Monthly trend">
          <SimpleLineChart data={o.monthlyTrend} />
        </ChartCard>
        <ChartCard title="Technician workload">
          <SimpleBarChart data={toData(o.byAssignee, users)} color="#215747" />
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "red" }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone === "red" ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
