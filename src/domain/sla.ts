/**
 * SLA computation for approval steps. All times in UTC.
 */
export interface SlaState {
  dueAt: Date;
  breached: boolean;
  approaching: boolean; // within the warning threshold but not yet breached
  hoursRemaining: number;
}

export const SLA_WARNING_RATIO = 0.25; // warn when <=25% of the window remains

export function computeDueAt(startedAt: Date, slaHours: number): Date {
  return new Date(startedAt.getTime() + slaHours * 60 * 60 * 1000);
}

export function evaluateSla(
  startedAt: Date,
  slaHours: number,
  now: Date = new Date(),
): SlaState {
  const dueAt = computeDueAt(startedAt, slaHours);
  const msRemaining = dueAt.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (60 * 60 * 1000);
  const breached = msRemaining <= 0;
  const warningWindowMs = slaHours * SLA_WARNING_RATIO * 60 * 60 * 1000;
  const approaching = !breached && msRemaining <= warningWindowMs;
  return { dueAt, breached, approaching, hoursRemaining };
}

/** Turnaround time in hours between two timestamps. */
export function turnaroundHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (60 * 60 * 1000);
}

/** Aging bucket for monitoring dashboards. */
export function agingBucket(hours: number): "0-24" | "24-48" | "48-72" | ">72" {
  if (hours <= 24) return "0-24";
  if (hours <= 48) return "24-48";
  if (hours <= 72) return "48-72";
  return ">72";
}
