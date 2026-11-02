import { notFound, redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import {
  getComplaint,
  listActivity,
  listComments,
  listAttachments,
  getRating,
  isOverdue,
} from "@/server/repo/complaints";
import {
  listCategories,
  listBlocks,
  listRooms,
  listUsers,
  listDepartments,
  findUserById,
} from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { canViewComplaint } from "@/lib/permissions";
import { CommentForm } from "@/components/complaints/comment-form";
import { ComplaintActions } from "@/components/complaints/complaint-actions";

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const complaint = await getComplaint(id);
  if (!complaint) notFound();

  // Same response as a missing complaint, so ids can't be probed for existence
  if (!canViewComplaint(session, complaint)) notFound();

  const [categories, blocks, rooms, technicians, departments] = [
    await listCategories(),
    await listBlocks(),
    await listRooms(),
    await listUsers("TECHNICIAN"),
    await listDepartments(),
  ];
  const category = categories.find((c) => c.id === complaint.categoryId);
  const block = blocks.find((b) => b.id === complaint.blockId);
  const room = rooms.find((r) => r.id === complaint.roomId);
  const reporter = await findUserById(complaint.reporterId);
  const assignee = complaint.assigneeId ? await findUserById(complaint.assigneeId) : undefined;

  const userById = new Map((await listUsers()).map((u) => [u.id, u]));
  const activity = await listActivity(id);
  const comments = await listComments(id, session.role !== "STUDENT");
  const attachments = await listAttachments(id);
  const rating = await getRating(id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={complaint.title}
        description={`${category?.name ?? "—"} · ${block?.name ?? "—"}${room ? ` · Room ${room.number}` : ""}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={complaint.status} />
        <PriorityBadge priority={complaint.priority} />
        {isOverdue(complaint) && <OverdueBadge />}
        {complaint.escalated && <Badge tone="red">Escalated</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-slate-700">{complaint.description}</CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence: before &amp; after</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["Before (reported by student)", attachments.filter((a) => a.kind === "EVIDENCE"), "slate"],
                      ["After (resolution evidence)", attachments.filter((a) => a.kind === "RESOLUTION"), "green"],
                    ] as const
                  ).map(([label, items, tone]) => (
                    <div key={label}>
                      <Badge tone={tone}>{label}</Badge>
                      <div className="mt-2 space-y-2">
                        {items.length === 0 && (
                          <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                            No photo yet
                          </p>
                        )}
                        {items.map((a) => (
                          <a
                            key={a.id}
                            href={a.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-2xl border border-slate-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.filePath}
                              alt={`${label}: ${a.fileName}`}
                              className="h-40 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l border-slate-200 pl-4">
                {activity.map((a) => {
                  const user = userById.get(a.userId);
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <p className="text-sm font-medium text-slate-800">
                        {user?.name ?? "System"}{" "}
                        <span className="font-normal text-slate-500">
                          {a.previousStatus
                            ? `moved this from ${a.previousStatus} to ${a.newStatus}`
                            : `set status to ${a.newStatus}`}
                        </span>
                      </p>
                      {a.comment && <p className="mt-0.5 text-sm text-slate-600">{a.comment}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">{formatDate(a.createdAt)}</p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {comments.map((c) => {
                  const author = userById.get(c.authorId);
                  return (
                    <div key={c.id} className="rounded-2xl bg-cream p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">{author?.name ?? "Unknown"}</p>
                        <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                      </div>
                      {c.isInternal && (
                        <Badge tone="purple" className="mt-1">
                          Internal note
                        </Badge>
                      )}
                      <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <CommentForm complaintId={id} allowInternal={session.role !== "STUDENT"} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DetailRow label="Reporter" value={reporter?.name ?? "—"} />
              <DetailRow label="Assigned to" value={assignee?.name ?? "Unassigned"} />
              <DetailRow label="Created" value={formatDate(complaint.createdAt)} />
              <DetailRow label="SLA deadline" value={formatDate(complaint.slaDeadline)} />
              <DetailRow label="Resolved on" value={formatDate(complaint.resolutionDate)} />
              {complaint.resolutionNotes && <DetailRow label="Resolution notes" value={complaint.resolutionNotes} />}
              {complaint.rejectionReason && <DetailRow label="Rejection reason" value={complaint.rejectionReason} />}
              {rating && <DetailRow label="Student rating" value={`${rating.score} / 5`} />}
            </CardContent>
          </Card>

          <ComplaintActions
            complaint={complaint}
            session={session}
            technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
            departments={departments}
            hasRating={!!rating}
          />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}
