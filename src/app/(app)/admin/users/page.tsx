import { listUsers, listDepartments } from "@/server/repo/reference-data";
import { createStaffUserAction, toggleUserActiveAction } from "@/server/actions/admin";
import { getSession } from "@/server/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  const users = listUsers();
  const departments = listDepartments();
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div>
      <PageHeader title="User management" description="Create staff accounts and activate or deactivate users." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-2 text-xs">{u.role}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {u.departmentId ? deptName.get(u.departmentId) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.id !== session?.id && (
                      <form
                        action={async (fd) => {
                          "use server";
                          await toggleUserActiveAction(fd);
                        }}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="isActive" value={u.isActive ? "false" : "true"} />
                        <Button size="sm" variant="ghost" type="submit">
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add staff account</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createStaffUserAction} submitLabel="Create account" className="space-y-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select id="role" name="role" defaultValue="TECHNICIAN">
                  <option value="TECHNICIAN">Technician</option>
                  <option value="ADMIN">Administrator</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select id="departmentId" name="departmentId" defaultValue="">
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
