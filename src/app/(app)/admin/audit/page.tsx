import { listAuditLog } from "@/server/repo/audit";
import { listUsers } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function AuditLogPage() {
  const logs = listAuditLog(300);
  const users = new Map(listUsers().map((u) => [u.id, u.name]));

  return (
    <div>
      <PageHeader title="Audit log" description="Security- and workflow-relevant actions (latest 300)." />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-2">{l.actorId ? (users.get(l.actorId) ?? l.actorId) : "System"}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {l.entityType}
                  {l.entityId ? ` · ${l.entityId.slice(0, 12)}` : ""}
                </td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-slate-400">{l.metadata ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
