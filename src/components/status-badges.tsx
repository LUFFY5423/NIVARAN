import { Badge } from "@/components/ui/primitives";
import { STATUS_LABELS } from "@/lib/types";
import type { ComplaintStatus, Priority } from "@/lib/types";

const statusTone: Record<ComplaintStatus, Parameters<typeof Badge>[0]["tone"]> = {
  SUBMITTED: "slate",
  UNDER_REVIEW: "blue",
  ASSIGNED: "purple",
  ACCEPTED: "purple",
  IN_PROGRESS: "amber",
  READY_FOR_VERIFICATION: "orange",
  RESOLVED: "green",
  CLOSED: "green",
  REOPENED: "red",
  REJECTED: "red",
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;
}

const priorityTone: Record<Priority, Parameters<typeof Badge>[0]["tone"]> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  EMERGENCY: "red",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={priorityTone[priority]}>{priority}</Badge>;
}

export function OverdueBadge() {
  return <Badge tone="red">⚠ Overdue</Badge>;
}
