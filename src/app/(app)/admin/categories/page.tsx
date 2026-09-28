import { listCategories, listSLAConfigs } from "@/server/repo/reference-data";
import { createCategoryAction, upsertSLAConfigAction } from "@/server/actions/admin";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui/primitives";
import { PRIORITIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  const categories = listCategories();
  const slas = listSLAConfigs();
  const hours = (cid: string, p: string) =>
    slas.find((s) => s.categoryId === cid && s.priority === p)?.hoursToSolve ?? "—";

  return (
    <div>
      <PageHeader
        title="Categories & SLA"
        description="Hours allowed to resolve a complaint, by category and priority. Applies to newly submitted complaints."
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Category</th>
              {PRIORITIES.map((p) => (
                <th key={p} className="px-4 py-3">
                  {p} (h)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                {PRIORITIES.map((p) => (
                  <td key={p} className="px-4 py-2 text-slate-600">
                    {hours(c.id, p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Update SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={upsertSLAConfigAction} submitLabel="Save SLA" className="space-y-3">
              <div>
                <Label htmlFor="sc">Category</Label>
                <Select id="sc" name="categoryId" required defaultValue="">
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sp">Priority</Label>
                <Select id="sp" name="priority" defaultValue="MEDIUM">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sh">Hours to resolve</Label>
                <Input id="sh" name="hoursToSolve" type="number" min={1} max={2000} required />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add category</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createCategoryAction} submitLabel="Add category" className="space-y-3">
              <div>
                <Label htmlFor="cn">Name</Label>
                <Input id="cn" name="name" required />
              </div>
              <div>
                <Label htmlFor="cd">Description</Label>
                <Input id="cd" name="description" />
              </div>
            </ActionForm>
            <p className="mt-3 text-xs text-slate-400">New categories use default SLA hours until configured.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
