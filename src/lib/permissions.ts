import type { ComplaintStatus, Role } from "@/lib/types";

export interface Actor {
  id: string;
  role: Role;
}
export interface ComplaintOwnership {
  reporterId: string;
  assigneeId: string | null;
}

/** Who may read a complaint: admins all; students only their own; technicians only assigned ones. */
export function canViewComplaint(actor: Actor, c: ComplaintOwnership): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "STUDENT") return c.reporterId === actor.id;
  if (actor.role === "TECHNICIAN") return c.assigneeId === actor.id;
  return false;
}

/** Which target statuses each role may set (in addition to the lifecycle table in types.ts). */
export const ROLE_ALLOWED_TARGETS: Record<Role, ComplaintStatus[]> = {
  STUDENT: ["RESOLVED", "REOPENED", "IN_PROGRESS"],
  TECHNICIAN: ["ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "UNDER_REVIEW"],
  ADMIN: ["UNDER_REVIEW", "ASSIGNED", "REJECTED", "CLOSED", "REOPENED"],
};

export function canActorSetStatus(actor: Actor, target: ComplaintStatus, c: ComplaintOwnership): boolean {
  if (!ROLE_ALLOWED_TARGETS[actor.role].includes(target)) return false;
  if (actor.role === "STUDENT") return c.reporterId === actor.id;
  if (actor.role === "TECHNICIAN") return c.assigneeId === actor.id;
  return true;
}
