import type { ComplaintStatus } from "@/lib/types";

const FINISHED: ComplaintStatus[] = ["RESOLVED", "CLOSED", "REJECTED"];

/** Pure SLA helpers (no DB) so they are trivially unit-testable. */
export function isPastDeadline(status: ComplaintStatus, slaDeadline: string | null, now = new Date()): boolean {
  if (FINISHED.includes(status) || !slaDeadline) return false;
  return new Date(slaDeadline).getTime() < now.getTime();
}

export function computeDeadline(hoursToSolve: number, from = new Date()): string {
  return new Date(from.getTime() + hoursToSolve * 3600 * 1000).toISOString();
}

export function slaCountdown(slaDeadline: string | null, now = new Date()): string {
  if (!slaDeadline) return "No SLA";
  const diff = new Date(slaDeadline).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const text = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return diff < 0 ? `Overdue by ${text}` : `${text} left`;
}
