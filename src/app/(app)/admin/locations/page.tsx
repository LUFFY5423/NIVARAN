import { listHostels, listBlocks, listRooms, listDepartments } from "@/server/repo/reference-data";
import {
  createHostelAction,
  createBlockAction,
  createRoomAction,
  createDepartmentAction,
} from "@/server/actions/admin";
import { PageHeader } from "@/components/layout/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default function LocationsPage() {
  const hostels = listHostels();
  const blocks = listBlocks();
  const rooms = listRooms();
  const departments = listDepartments();

  return (
    <div>
      <PageHeader
        title="Hostels, locations & departments"
        description="Manage the places and teams complaints are routed to."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hostels &amp; blocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {hostels.map((h) => (
              <div key={h.id}>
                <p className="font-medium text-slate-800">{h.name}</p>
                <p className="text-xs text-slate-500">
                  {blocks
                    .filter((b) => b.hostelId === h.id)
                    .map((b) => `${b.name} (${rooms.filter((r) => r.blockId === b.id).length} rooms)`)
                    .join(" · ") || "No blocks"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="mb-3 space-y-1 text-sm text-slate-700">
              {departments.map((d) => (
                <li key={d.id}>• {d.name}</li>
              ))}
            </ul>
            <ActionForm action={createDepartmentAction} submitLabel="Add department" size="sm" variant="outline">
              <Label htmlFor="deptName">New department</Label>
              <Input id="deptName" name="name" required />
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add hostel</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createHostelAction} submitLabel="Add hostel" className="space-y-3">
              <div>
                <Label htmlFor="hname">Name</Label>
                <Input id="hname" name="name" required />
              </div>
              <div>
                <Label htmlFor="haddr">Address</Label>
                <Input id="haddr" name="address" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add block</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createBlockAction} submitLabel="Add block" className="space-y-3">
              <div>
                <Label htmlFor="bh">Hostel</Label>
                <Select id="bh" name="hostelId" required defaultValue="">
                  <option value="" disabled>
                    Select hostel
                  </option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="bn">Block name</Label>
                <Input id="bn" name="name" required />
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Add room</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createRoomAction} submitLabel="Add room" className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="rb">Block</Label>
                <Select id="rb" name="blockId" required defaultValue="">
                  <option value="" disabled>
                    Select block
                  </option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {hostels.find((h) => h.id === b.hostelId)?.name} – {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rn">Room number</Label>
                <Input id="rn" name="number" required />
              </div>
              <div>
                <Label htmlFor="rf">Floor</Label>
                <Input id="rf" name="floor" type="number" min={0} defaultValue={1} />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
