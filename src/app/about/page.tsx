import { PublicHeader } from "@/components/layout/public-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

const demoAccounts = [
  { role: "Administrator", email: "admin@nivaran.edu", name: "Priya Sharma" },
  { role: "Technician (Electrical)", email: "ramesh.tech@nivaran.edu", name: "Ramesh Kumar" },
  { role: "Technician (Plumbing)", email: "sunita.tech@nivaran.edu", name: "Sunita Devi" },
  { role: "Student", email: "aarav.student@nivaran.edu", name: "Aarav Mehta" },
  { role: "Student", email: "diya.student@nivaran.edu", name: "Diya Patel" },
  { role: "Student", email: "kabir.student@nivaran.edu", name: "Kabir Singh" },
  { role: "Student", email: "anika.student@nivaran.edu", name: "Anika Reddy" },
  { role: "Student", email: "vihaan.student@nivaran.edu", name: "Vihaan Nair" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-bold text-slate-900">About Nivaran</h1>
        <p className="mt-3 text-slate-600">
          Nivaran (from the Hindi/Sanskrit word for &ldquo;resolution&rdquo;) is a prototype platform for reporting and
          resolving student housing maintenance issues and grievances. It gives students a direct channel to report
          problems, gives maintenance staff a structured queue with deadlines, and gives administrators the visibility
          and data to hold the process accountable.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>What makes a complaint accountable here</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>• A full, timestamped activity history on every complaint — who changed what, and when.</p>
            <p>• SLA deadlines by category and priority, with automatic overdue escalation.</p>
            <p>
              • A complaint can only be closed after the student confirms the fix, or an administrator overrides with a
              recorded reason.
            </p>
            <p>• Students can reopen anything that wasn&apos;t actually fixed.</p>
            <p>
              • An anonymized public statistics page shows resolution performance without exposing any student&apos;s
              identity or complaint details.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Demo accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-600">
              All accounts below are <strong>fictional</strong> and use the password{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">Password123!</code>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {demoAccounts.map((a) => (
                    <tr key={a.email} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 text-slate-500">{a.role}</td>
                      <td className="py-2 pr-4">{a.name}</td>
                      <td className="py-2 font-mono text-xs text-slate-600">{a.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Known limitations of this prototype</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              • Uses SQLite via Node&apos;s built-in driver instead of Prisma at runtime (network-restricted sandbox
              could not fetch Prisma&apos;s engine binary) — see the README for details and the migration path back to
              Prisma + Postgres.
            </p>
            <p>
              • Attachments are stored on local disk, suitable for a single-instance demo, not multi-server production.
            </p>
            <p>• SLA escalation runs on-demand from an admin button rather than a real background scheduler.</p>
            <p>• Email notifications are not implemented; an abstraction is in place to add them later.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
