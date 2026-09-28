"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignComplaintAction,
  technicianRespondAssignmentAction,
  startWorkAction,
  markReadyForVerificationAction,
  studentConfirmResolutionAction,
  studentReopenAction,
  rateComplaintAction,
  adminCloseComplaintAction,
  adminRejectComplaintAction,
  adminChangePriorityAction,
  adminOverrideCloseAction,
} from "@/server/actions/complaints";
import type { ActionResult } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
  FormError,
} from "@/components/ui/primitives";
import { PRIORITIES } from "@/lib/types";
import type { ComplaintRow, SessionUser } from "@/lib/types";

function useRunner() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>, success: string) => {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setOk(success);
        router.refresh();
      }
    });
  };
  return { error, ok, pending, run };
}

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  return (
    <>
      <FormError>{error}</FormError>
      {ok && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {ok}
        </p>
      )}
    </>
  );
}

export function ComplaintActions({
  complaint,
  session,
  technicians,
  departments,
  hasRating = false,
}: {
  complaint: ComplaintRow;
  session: SessionUser;
  technicians: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  hasRating?: boolean;
}) {
  if (session.role === "STUDENT") return <StudentActions complaint={complaint} hasRating={hasRating} />;
  if (session.role === "TECHNICIAN") return <TechnicianActions complaint={complaint} />;
  return <AdminActions complaint={complaint} technicians={technicians} departments={departments} />;
}

function StudentActions({ complaint, hasRating }: { complaint: ComplaintRow; hasRating: boolean }) {
  const { error, ok, pending, run } = useRunner();
  const s = complaint.status;
  const canReopen = s === "RESOLVED" || s === "CLOSED";
  const canRate = (s === "RESOLVED" || s === "CLOSED") && !hasRating;

  if (s !== "READY_FOR_VERIFICATION" && !canReopen && !canRate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {s === "READY_FOR_VERIFICATION" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">The technician says this is fixed. Please verify.</p>
            <Button
              variant="success"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => studentConfirmResolutionAction(complaint.id), "Thanks for confirming!")}
            >
              Yes, it&apos;s resolved
            </Button>
          </div>
        )}
        {(s === "READY_FOR_VERIFICATION" || canReopen) && (
          <form
            action={(fd) =>
              run(
                () => studentReopenAction(fd),
                s === "READY_FOR_VERIFICATION" ? "Sent back to the technician." : "Complaint reopened."
              )
            }
            className="space-y-2"
          >
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="reason">
              {s === "READY_FOR_VERIFICATION" ? "Not fixed? Tell us why" : "Problem still there? Reopen"}
            </Label>
            <Textarea id="reason" name="reason" rows={2} placeholder="What is still wrong?" />
            <Button type="submit" variant="danger" className="w-full" disabled={pending}>
              {s === "READY_FOR_VERIFICATION" ? "Not fixed" : "Reopen complaint"}
            </Button>
          </form>
        )}
        {canRate && (
          <form action={(fd) => run(() => rateComplaintAction(fd), "Thanks for your feedback!")} className="space-y-2">
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="score">Rate the resolution</Label>
            <Select id="score" name="score" defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "star" : "stars"}
                </option>
              ))}
            </Select>
            <Textarea name="feedback" rows={2} placeholder="Optional feedback" aria-label="Feedback" />
            <Button type="submit" variant="outline" className="w-full" disabled={pending}>
              Submit rating
            </Button>
          </form>
        )}
        <Feedback error={error} ok={ok} />
      </CardContent>
    </Card>
  );
}

function TechnicianActions({ complaint }: { complaint: ComplaintRow }) {
  const { error, ok, pending, run } = useRunner();
  const s = complaint.status;
  if (!["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(s)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {s === "ASSIGNED" && (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => technicianRespondAssignmentAction(complaint.id, true), "Assignment accepted.")}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => technicianRespondAssignmentAction(complaint.id, false), "Assignment declined.")}
            >
              Decline
            </Button>
          </div>
        )}
        {s === "ACCEPTED" && (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => run(() => startWorkAction(complaint.id), "Work started.")}
          >
            Start work
          </Button>
        )}
        {s === "IN_PROGRESS" && (
          <form
            action={(fd) => run(() => markReadyForVerificationAction(fd), "Sent to the student for verification.")}
            className="space-y-2"
          >
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="resolutionNotes">Work performed</Label>
            <Textarea
              id="resolutionNotes"
              name="resolutionNotes"
              rows={3}
              placeholder="Describe what you did…"
              required
            />
            <Label htmlFor="resolutionEvidence">Resolution photo (optional)</Label>
            <Input
              id="resolutionEvidence"
              name="resolutionEvidence"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
            />
            <Button type="submit" variant="success" className="w-full" disabled={pending}>
              Mark ready for verification
            </Button>
          </form>
        )}
        <Feedback error={error} ok={ok} />
      </CardContent>
    </Card>
  );
}

function AdminActions({
  complaint,
  technicians,
  departments,
}: {
  complaint: ComplaintRow;
  technicians: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const { error, ok, pending, run } = useRunner();
  const s = complaint.status;
  const canAssign = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "REOPENED"].includes(s);
  const canReject = ["SUBMITTED", "UNDER_REVIEW"].includes(s);
  const canClose = s === "RESOLVED";
  const canOverride = !["CLOSED", "REJECTED"].includes(s);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {canAssign && (
          <form action={(fd) => run(() => assignComplaintAction(fd), "Complaint assigned.")} className="space-y-2">
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="technicianId">{s === "ASSIGNED" ? "Reassign to" : "Assign to"}</Label>
            <Select id="technicianId" name="technicianId" required defaultValue="">
              <option value="" disabled>
                Select technician
              </option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select name="departmentId" defaultValue="" aria-label="Department">
              <option value="">Department (optional)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Input name="note" placeholder="Note for technician (optional)" aria-label="Note" />
            <Button type="submit" className="w-full" disabled={pending}>
              Assign
            </Button>
          </form>
        )}

        <form action={(fd) => run(() => adminChangePriorityAction(fd), "Priority updated.")} className="space-y-2">
          <input type="hidden" name="complaintId" value={complaint.id} />
          <Label htmlFor="priority">Priority</Label>
          <div className="flex gap-2">
            <Select id="priority" name="priority" defaultValue={complaint.priority}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline" disabled={pending}>
              Save
            </Button>
          </div>
        </form>

        {canClose && (
          <form action={(fd) => run(() => adminCloseComplaintAction(fd), "Complaint closed.")}>
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
              Close complaint
            </Button>
          </form>
        )}

        {canReject && (
          <form action={(fd) => run(() => adminRejectComplaintAction(fd), "Complaint rejected.")} className="space-y-2">
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="rejectReason">Reject with reason</Label>
            <Textarea id="rejectReason" name="reason" rows={2} placeholder="Reason (required)" required />
            <Button type="submit" variant="danger" className="w-full" disabled={pending}>
              Reject complaint
            </Button>
          </form>
        )}

        {canOverride && (
          <form
            action={(fd) => run(() => adminOverrideCloseAction(fd), "Closed by administrator override.")}
            className="space-y-2 border-t border-slate-100 pt-4"
          >
            <input type="hidden" name="complaintId" value={complaint.id} />
            <Label htmlFor="overrideReason">Close without student confirmation</Label>
            <Textarea
              id="overrideReason"
              name="reason"
              rows={2}
              placeholder="Recorded override reason (required)"
              required
            />
            <Button type="submit" variant="outline" className="w-full" disabled={pending}>
              Override &amp; close
            </Button>
          </form>
        )}
        <Feedback error={error} ok={ok} />
      </CardContent>
    </Card>
  );
}
