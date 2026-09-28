import { PublicHeader } from "@/components/layout/public-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { SimpleLineChart } from "@/components/charts/line-chart";
import { publicStats } from "@/server/repo/analytics";
import { listCategories } from "@/server/repo/reference-data";

export const dynamic = "force-dynamic";

export default async function PublicStatsPage() {
  const stats = publicStats();
  const categories = listCategories();
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const byCategoryData = Object.entries(stats.byCategory).map(([id, count]) => ({
    label: categoryName(id),
    value: count,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="text-3xl font-bold text-slate-900">Public performance statistics</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Aggregate, anonymized figures across all complaints on the platform. No student identities, room numbers, or
          complaint text are shown here.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total complaints" value={stats.total} />
          <StatCard label="Resolution rate" value={`${stats.resolutionRate}%`} />
          <StatCard
            label="Avg. resolution time"
            value={stats.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : "—"}
          />
          <StatCard label="Satisfaction (1–5)" value={stats.satisfaction ?? "—"} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Complaints by category</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={byCategoryData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Monthly complaint volume</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLineChart data={stats.monthlyTrend} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
