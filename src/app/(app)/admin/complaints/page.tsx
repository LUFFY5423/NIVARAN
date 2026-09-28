import { listComplaints } from "@/server/repo/complaints";
import { listCategories, listBlocks, listUsers } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { ComplaintTable } from "@/components/complaints/complaint-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Label, Select } from "@/components/ui/primitives";
import { STATUS_LABELS, PRIORITIES } from "@/lib/types";
import type { ComplaintStatus, Priority } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const complaints = listComplaints({
    status: (sp.status as ComplaintStatus) || undefined,
    category: sp.category || undefined,
    priority: (sp.priority as Priority) || undefined,
    blockId: sp.block || undefined,
    assigneeId: sp.assignee || undefined,
    dateFrom: sp.from || undefined,
    dateTo: sp.to ? `${sp.to}T23:59:59.999Z` : undefined,
    search: sp.q || undefined,
  });
  const categories = listCategories();
  const blocks = listBlocks();
  const users = listUsers();
  const technicians = users.filter((u) => u.role === "TECHNICIAN");
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const exportParams = new URLSearchParams();
  for (const k of ["status", "category", "priority", "block", "assignee", "from", "to"]) {
    if (sp[k]) exportParams.set(k, sp[k]!);
  }

  return (
    <div>
      <PageHeader
        title="All complaints"
        description={`${complaints.length} result${complaints.length === 1 ? "" : "s"}`}
        action={
          <a href={`/api/export/complaints?${exportParams.toString()}`}>
            <Button variant="outline">Export CSV</Button>
          </a>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-4">
          <form method="get" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            <div className="col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={sp.q} placeholder="Title or description" />
            </div>
            <FilterSelect id="status" label="Status" value={sp.status} options={Object.entries(STATUS_LABELS)} />
            <FilterSelect
              id="category"
              label="Category"
              value={sp.category}
              options={categories.map((c) => [c.id, c.name])}
            />
            <FilterSelect id="priority" label="Priority" value={sp.priority} options={PRIORITIES.map((p) => [p, p])} />
            <FilterSelect id="block" label="Block" value={sp.block} options={blocks.map((b) => [b.id, b.name])} />
            <FilterSelect
              id="assignee"
              label="Assigned to"
              value={sp.assignee}
              options={technicians.map((t) => [t.id, t.name])}
            />
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={sp.from} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={sp.to} />
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-2">
              <Button type="submit">Apply filters</Button>
              <a href="/admin/complaints">
                <Button type="button" variant="ghost">
                  Reset
                </Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <ComplaintTable
        complaints={complaints}
        categoryName={(id) => catName.get(id) ?? "—"}
        showReporterCol
        reporterName={(id) => userName.get(id) ?? "—"}
        showAssigneeCol
        assigneeName={(id) => (id ? (userName.get(id) ?? "—") : "Unassigned")}
      />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
}: {
  id: string;
  label: string;
  value?: string;
  options: (readonly [string, string])[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={id} defaultValue={value ?? ""}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}
