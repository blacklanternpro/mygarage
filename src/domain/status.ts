import type { FindingStatus, Severity } from "@/db/schema";

/** Red/Amber items still outstanding (not fixed, not resolved elsewhere). */
export const OUTSTANDING_STATUSES: FindingStatus[] = ["OPEN", "QUOTE_REQUESTED", "QUOTED", "PLANNED", "DECLINED", "APPROVED", "BOOKED"];

/** Deferred work the counter can still recover. */
export const RECOVERABLE_STATUSES: FindingStatus[] = ["OPEN", "QUOTE_REQUESTED", "QUOTED", "PLANNED", "DECLINED"];

export const SEVERITY_RANK: Record<Severity, number> = { URGENT_RED: 0, WATCH_AMBER: 1, HEALTHY_GREEN: 2 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  URGENT_RED: "Urgent",
  WATCH_AMBER: "Watch",
  HEALTHY_GREEN: "Healthy",
};

export const STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: "Open",
  QUOTE_REQUESTED: "Quote requested",
  QUOTED: "Fixed quote ready",
  APPROVED: "Approved",
  BOOKED: "Booked in",
  PLANNED: "Planned for later",
  DECLINED: "Declined",
  RESOLVED_ELSEWHERE: "Resolved elsewhere",
  COMPLETED: "Done",
};

export function worstSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>((w, s) => (SEVERITY_RANK[s] < SEVERITY_RANK[w] ? s : w), "HEALTHY_GREEN");
}
