export type Role = "STUDENT" | "ADMIN" | "TECHNICIAN";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";

export type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "READY_FOR_VERIFICATION"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "REJECTED";

export type NotificationType =
  | "COMPLAINT_SUBMITTED"
  | "COMPLAINT_ASSIGNED"
  | "STATUS_CHANGED"
  | "NEW_COMMENT"
  | "SLA_NEARING"
  | "SLA_OVERDUE"
  | "READY_FOR_VERIFICATION"
  | "REOPENED";

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  READY_FOR_VERIFICATION: "Ready for Verification",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  REJECTED: "Rejected",
};

// Valid forward transitions in the complaint lifecycle. Kept centralized so
// every code path (server actions, API routes, tests) enforces the same
// rules instead of re-implementing the state machine.
export const STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["ACCEPTED", "UNDER_REVIEW", "REJECTED"], // technician rejects assignment -> back to review
  ACCEPTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["READY_FOR_VERIFICATION"],
  READY_FOR_VERIFICATION: ["RESOLVED", "IN_PROGRESS"], // student rejects verification -> back to work
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["UNDER_REVIEW", "ASSIGNED"],
  REJECTED: [],
};

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone: string | null;
  isActive: number;
  roomId: string | null;
  departmentId: string | null;
  available: number;
  specialties: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintRow {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  subcategory: string | null;
  locationNote: string | null;
  blockId: string | null;
  roomId: string | null;
  floor: number | null;
  priority: Priority;
  status: ComplaintStatus;
  reporterId: string;
  assigneeId: string | null;
  departmentId: string | null;
  slaDeadline: string | null;
  escalated: number;
  resolutionDate: string | null;
  resolutionNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
