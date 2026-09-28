import { getSession } from "@/server/auth";
import { findUserById, listDepartments } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, Badge } from "@/components/ui/primitives";
import { AvailabilityToggle } from "@/components/profile/availability-toggle";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;
  const user = findUserById(session.id);
  if (!user) return null;
  const dept = listDepartments().find((d) => d.id === user.departmentId);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile & settings" />
      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? "—"} />
          <div className="flex justify-between">
            <span className="text-slate-400">Role</span>
            <Badge tone="blue">{user.role}</Badge>
          </div>
          {user.role === "TECHNICIAN" && (
            <>
              <Row label="Department" value={dept?.name ?? "—"} />
              <Row label="Specialties" value={user.specialties ?? "—"} />
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <p className="font-medium text-slate-800">Availability</p>
                  <p className="text-xs text-slate-400">Let admins know whether you can take new work.</p>
                </div>
                <AvailabilityToggle initial={user.available === 1} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Demo data is fictional. Profile editing beyond availability is out of scope for this prototype.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
