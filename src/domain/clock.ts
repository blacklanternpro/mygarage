/** Single source of "now". Honours DEMO_NOW (ISO 8601) for repeatable demos and tests. */
export function now(): Date {
  const fixed = process.env.DEMO_NOW;
  if (fixed) {
    const d = new Date(fixed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export const DAY_MS = 86_400_000;

/** Workshop-local timezone by state (Stage 1 workshops are WA). */
export const STATE_TIMEZONE: Record<string, string> = {
  WA: "Australia/Perth",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane",
  SA: "Australia/Adelaide",
  NT: "Australia/Darwin",
};
export const DEFAULT_TZ = "Australia/Perth";

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function isoDate(d: Date, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Whole calendar days from `from` to the ISO date `to` (negative when in the past). */
export function daysUntil(to: string, from: Date = now(), tz: string = DEFAULT_TZ): number {
  const a = Date.parse(`${isoDate(from, tz)}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export function addDaysIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Next given weekday (0 = Sunday … 6 = Saturday) strictly after `from`, as ISO date. */
export function nextWeekday(weekday: number, from: Date = now(), tz: string = DEFAULT_TZ): string {
  const today = isoDate(from, tz);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  let delta = (weekday - dow + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysIso(today, delta);
}
