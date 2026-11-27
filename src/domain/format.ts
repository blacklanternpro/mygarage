import { DEFAULT_TZ, daysUntil, now } from "./clock";
import type { LineItem } from "@/db/schema";

const audFull = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const audWhole = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat("en-AU");

/**
 * A$1,234.56 — money is stored as integer cents, inc. GST.
 * `whole: true` drops the cents (used for indicative ranges and headline totals).
 */
export function formatAud(cents: number, opts: { whole?: boolean } = {}): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}A$${opts.whole ? audWhole.format(Math.round(abs)) : audFull.format(abs)}`;
}

/** Always two decimals (invoices, quotes): A$468.00 */
export function formatAudExact(cents: number): string {
  return formatAud(cents);
}

/** Indicative range: A$420 – A$480 */
export function formatAudRange(lowCents: number, highCents: number): string {
  return `${formatAud(lowCents, { whole: true })} – ${formatAud(highCents, { whole: true })}`;
}

/** GST component of a GST-inclusive amount (1/11), rounded to the cent. */
export function gstFromInclusive(totalCents: number): number {
  return Math.round(totalCents / 11);
}

export function totalsFromLineItems(items: Pick<LineItem, "totalCents">[]) {
  const totalCents = items.reduce((s, i) => s + i.totalCents, 0);
  const gstCents = gstFromInclusive(totalCents);
  return { totalCents, gstCents, subtotalCents: totalCents - gstCents };
}

/** DD/MM/YYYY from an ISO date string (YYYY-MM-DD) or a Date (workshop timezone). */
export function formatDate(value: string | Date | null | undefined, tz: string = DEFAULT_TZ): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** 27/11/2026, 9:42 pm */
export function formatDateTime(value: Date | string, tz: string = DEFAULT_TZ): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const d = formatDate(date, tz);
  const t = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
  return `${d}, ${t}`;
}

/** Fri 04/12 */
export function formatShortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(d);
  const [, m, day] = iso.split("-");
  return `${wd} ${day}/${m}`;
}

export function formatKm(km: number): string {
  return `${intFmt.format(Math.round(km))} km`;
}

export function formatNumber(n: number): string {
  return intFmt.format(n);
}

/** Normalise a rego for comparison: uppercase, single spaces. */
export function normaliseRego(rego: string): string {
  return rego.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

export function regoKey(rego: string): string {
  return rego.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "in 24 days" · "today" · "tomorrow" · "3 days ago" */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function daysFromToday(iso: string | null | undefined, from: Date = now()): number | null {
  return iso ? daysUntil(iso, from) : null;
}

/** Mask an Australian mobile for display: 0491 ••• 110 */
export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`;
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
