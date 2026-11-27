/**
 * Voice-first bay DVI (research §3, tier 3). The STT adapter turns a held-thumb dictation into a
 * transcript; `structureDictation` (pure, deterministic) turns mechanic shorthand into a
 * plain-English customer finding with severity, horizon and an indicative estimate range.
 * Findings save as PENDING_REVIEW — the advisor publishes them from the counter.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { findings, inspectionReports, vehicles } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { Svc } from "./context";
import { notFound, unprocessable } from "./errors";
import { isoDate, now } from "./clock";
import { CATEGORY_LABELS, DIAGRAM_FOR_CATEGORY, inferCategory } from "./categories";
import { appendAuditEvent } from "./audit";
import { syncWalletPass, garageUrl } from "./wallet";

export interface JargonHit {
  heard: string;
  plain: string;
}

export interface FindingDraft {
  transcript: string;
  severity: "URGENT_RED" | "WATCH_AMBER" | "HEALTHY_GREEN";
  category: string;
  categoryLabel: string;
  component: string;
  position: string | null;
  title: string;
  customerExplanation: string;
  measurement: string | null;
  horizonText: string | null;
  estimateLowCents: number | null;
  estimateHighCents: number | null;
  diagram: string | null;
  jargon: JargonHit[];
  confidence: number;
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

const COMPONENTS: [RegExp, string, string][] = [
  // [pattern, singular name, plural name]
  [/\bshock(s| absorbers?)?\b/i, "shock absorber", "shock absorbers"],
  [/\bpads?\b/i, "brake pad", "brake pads"],
  [/\b(rotors?|discs?)\b/i, "brake disc", "brake discs"],
  [/\bshoes?\b/i, "brake shoe", "brake shoes"],
  [/\bcv boot('?s)?\b/i, "CV boot", "CV boots"],
  [/\bwiper blades?\b|\bwipers?\b/i, "wiper blade", "wiper blades"],
  [/\btyres?\b|\btires?\b/i, "tyre", "tyres"],
  [/\bbattery\b/i, "battery", "battery"],
  [/\b(control arm )?bush(es|ings?)?\b/i, "suspension bush", "suspension bushes"],
  [/\brocker cover( gasket)?\b/i, "rocker cover gasket", "rocker cover gasket"],
  [/\b(drive|accessory|serpentine) belt\b/i, "drive belt", "drive belt"],
  [/\bhoses?\b/i, "coolant hose", "coolant hoses"],
  [/\b(globe|bulb)s?\b/i, "light globe", "light globes"],
];

const JARGON: [RegExp, string, string][] = [
  [/misting oil|misting/i, "misting oil", "is starting to leak a fine film of oil — an early sign the seal is wearing"],
  [/weeping/i, "weeping", "is slowly seeping fluid"],
  [/metal on metal/i, "metal on metal", "is almost down to the metal backing, which damages the discs"],
  [/flinging grease/i, "flinging grease", "is throwing out the grease that protects the joint"],
  [/\bsplit\b/i, "split", "has split open"],
  [/smearing/i, "smearing", "is leaving streaks instead of clearing the glass"],
  [/\bmil\b|\bmm\b/i, "mil", "millimetres"],
  [/no dramas/i, "no dramas", "nothing to worry about"],
  [/with a machine|machine of the rotors|machine/i, "machine (rotors)", "resurface the brake discs so the new pads bed in"],
  [/bucks/i, "bucks", "dollars"],
];

function parsePosition(t: string): string | null {
  const s = t.toLowerCase();
  const fb = /\bfront\b/.test(s) ? "front" : /\brear\b|\bback\b/.test(s) ? "rear" : null;
  const lr = /\bleft\b|\blh\b|\bpassenger side\b/.test(s) ? "left" : /\bright\b|\brh\b|\bdriver'?s side\b/.test(s) ? "right" : null;
  if (/all round|all four/.test(s)) return "all round";
  if (fb && lr) return `${fb} ${lr}`;
  return fb ?? lr;
}

function parseMeasurement(t: string): string | null {
  const s = t.toLowerCase();
  const num = s.match(/(\d+(?:\.\d+)?)\s*(mm|mil|millimetres?)/);
  if (num) return `${num[1]} mm`;
  const halfWord = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)( and a half)?\s*(mil|mm)\b/);
  if (halfWord) return `${WORD_NUMBERS[halfWord[1]] + (halfWord[2] ? 0.5 : 0)} mm`;
  const pct = s.match(/(\d+)\s*(%|percent)/);
  if (pct) return `${pct[1]}%`;
  return null;
}

function parseRange(t: string): [number, number] | null {
  const s = t.replace(/,/g, "");
  const m = s.match(/\$?(\d{2,5})\s*(?:to|-|–|or)\s*\$?(\d{2,5})/i);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    return a <= b ? [a * 100, b * 100] : [b * 100, a * 100];
  }
  const single = s.match(/(?:about|roughly|around)\s*\$?(\d{2,5})/i);
  if (single) {
    const v = parseInt(single[1], 10) * 100;
    return [Math.round(v * 0.9), Math.round(v * 1.1)];
  }
  return null;
}

function parseSeverity(t: string): FindingDraft["severity"] {
  const s = t.toLowerCase();
  if (/(needs doing (today|now)|unsafe|metal on metal|don'?t drive|dangerous|do it today|straight away|asap)/.test(s)) return "URGENT_RED";
  if (/(all good|no dramas|fine|healthy|good,|good\.|plenty left|within spec)/.test(s) && !/(watch|replace|leak|split|smear)/.test(s)) return "HEALTHY_GREEN";
  return "WATCH_AMBER";
}

function parseHorizon(t: string, severity: FindingDraft["severity"]): string | null {
  const s = t.toLowerCase();
  if (severity === "URGENT_RED") return "Before you drive much further";
  if (/next service/.test(s)) return "At your next service";
  if (/before winter/.test(s)) return "Before winter";
  const months = s.match(/within (a|one|two|three|\d+) months?/);
  if (months) {
    const n = months[1] === "a" || months[1] === "one" ? 1 : WORD_NUMBERS[months[1]] ?? parseInt(months[1], 10);
    return n === 1 ? "Within a month" : `Within ${n} months`;
  }
  if (/whenever|next in|when convenient/.test(s)) return "Next time it's in";
  const k = s.match(/(\d+)\s*(k|thousand)\s*(km|kms|k's)?/);
  if (k) return `Within ~${parseInt(k[1], 10).toLocaleString("en-AU")},000 km`;
  return severity === "HEALTHY_GREEN" ? null : "Keep an eye on it";
}

export function structureDictation(transcript: string): FindingDraft {
  const t = transcript.trim();
  const severity = parseSeverity(t);
  const category = inferCategory(t);
  const comp = COMPONENTS.find(([re]) => re.test(t));
  const plural = /\b(pair|both|all round|all four|pads|shocks|tyres|blades|wipers|shoes)\b/i.test(t);
  const component = comp ? (plural ? comp[2] : comp[1]) : (CATEGORY_LABELS[category] ?? "Item").toLowerCase();
  const position = parsePosition(t);
  const measurement = parseMeasurement(t);
  const range = severity === "HEALTHY_GREEN" ? null : parseRange(t);
  const jargon = JARGON.filter(([re]) => re.test(t)).map(([, heard, plain]) => ({ heard, plain }));
  const condition = jargon.find((j) => !["mil", "bucks", "machine (rotors)", "no dramas"].includes(j.heard));
  const horizonText = parseHorizon(t, severity);

  const subject = `${position ? `${position.charAt(0).toUpperCase()}${position.slice(1)} ` : ""}${component}`.replace(/^./, (c) => c.toUpperCase());
  const conditionPhrase = condition ? condition.heard : severity === "HEALTHY_GREEN" ? "checked" : measurement ? `at ${measurement}` : "needs attention";
  const title =
    severity === "HEALTHY_GREEN"
      ? `${subject} — healthy${measurement ? ` (${measurement})` : ""}`
      : condition
        ? `${subject} ${conditionPhrase}`
        : measurement
          ? `${subject} worn to ${measurement}`
          : `${subject} needs attention`;

  const verb = component.endsWith("s") && !component.endsWith("ss") ? "are" : "is";
  let customerExplanation: string;
  if (severity === "HEALTHY_GREEN") customerExplanation = `We checked your ${component}${measurement ? ` (${measurement})` : ""} and ${verb === "are" ? "they're" : "it's"} in good shape.`;
  else {
    const what = condition ? condition.plain.replace(/^is /, verb === "are" ? "are " : "is ") : measurement ? `${verb} down to ${measurement}` : `${verb} wearing`;
    const why = severity === "URGENT_RED" ? " This affects how safely the vehicle stops or handles, so please book it in before you drive much further." : ` It's not urgent yet. ${horizonText ? `Plan for it: ${horizonText.charAt(0).toLowerCase()}${horizonText.slice(1)}.` : "Keep an eye on it."}`;
    customerExplanation = `Your ${position ? `${position} ` : ""}${component} ${what}.${why}`;
  }
  const confidence = Math.min(0.98, 0.55 + (comp ? 0.15 : 0) + (range ? 0.1 : 0) + (horizonText ? 0.08 : 0) + (position ? 0.05 : 0) + (measurement ? 0.05 : 0));
  return {
    transcript: t,
    severity,
    category,
    categoryLabel: CATEGORY_LABELS[category] ?? category,
    component,
    position,
    title,
    customerExplanation,
    measurement,
    horizonText,
    estimateLowCents: range?.[0] ?? null,
    estimateHighCents: range?.[1] ?? null,
    diagram: DIAGRAM_FOR_CATEGORY[category] ?? null,
    jargon,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────

export const saveDraftSchema = z.object({
  vehicleId: z.string().uuid(),
  technicianName: z.string().trim().min(2).max(80),
  transcript: z.string().trim().min(3).max(2000),
  severity: z.enum(["URGENT_RED", "WATCH_AMBER", "HEALTHY_GREEN"]),
  title: z.string().trim().min(3).max(140),
  customerExplanation: z.string().trim().min(3).max(1000),
  category: z.string().min(2).max(40),
  measurement: z.string().max(80).nullable().optional(),
  horizonText: z.string().max(120).nullable().optional(),
  estimateLowCents: z.number().int().min(0).nullable().optional(),
  estimateHighCents: z.number().int().min(0).nullable().optional(),
  annotation: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), label: z.string().max(40) })).max(6).optional(),
});

export async function saveVoiceFinding(svc: Svc, input: z.infer<typeof saveDraftSchema>) {
  const [v] = await svc.db.select().from(vehicles).where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, input.vehicleId)));
  if (!v) throw notFound("Vehicle");
  if (input.severity !== "HEALTHY_GREEN" && (input.estimateLowCents == null || input.estimateHighCents == null))
    throw unprocessable("ESTIMATE_REQUIRED", "Add an indicative range so the customer can budget.");
  if (input.estimateLowCents != null && input.estimateHighCents != null && input.estimateLowCents > input.estimateHighCents)
    throw unprocessable("BAD_RANGE", "The low estimate must be below the high estimate.");
  const today = isoDate(now());
  const reports = await svc.db
    .select()
    .from(inspectionReports)
    .where(scoped(inspectionReports, svc.workshop.id, eq(inspectionReports.vehicleId, v.id), eq(inspectionReports.status, "IN_BAY")))
    .orderBy(desc(inspectionReports.inspectedAt));
  let report = reports.find((r) => isoDate(r.inspectedAt) === today);
  if (!report)
    [report] = await svc.db
      .insert(inspectionReports)
      .values({ workshopId: svc.workshop.id, vehicleId: v.id, inspectedAt: now(), odometerKm: v.odometerKm, technicianName: input.technicianName, summary: "Voice-first bay inspection", status: "IN_BAY" })
      .returning();
  const [f] = await svc.db
    .insert(findings)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: v.id,
      inspectionReportId: report.id,
      severity: input.severity,
      category: input.category,
      title: input.title,
      customerExplanation: input.customerExplanation,
      technicianNote: input.transcript,
      measurement: input.measurement ?? null,
      diagram: DIAGRAM_FOR_CATEGORY[input.category] ?? null,
      horizonText: input.horizonText ?? null,
      estimateLowCents: input.severity === "HEALTHY_GREEN" ? null : input.estimateLowCents ?? null,
      estimateHighCents: input.severity === "HEALTHY_GREEN" ? null : input.estimateHighCents ?? null,
      safetyCritical: input.severity === "URGENT_RED",
      status: "OPEN",
      reviewStatus: "PENDING_REVIEW",
      source: "VOICE_DVI",
      annotation: input.annotation ?? null,
      sortOrder: 50,
    })
    .returning();
  return f;
}

export async function pendingFindings(svc: Svc) {
  return svc.db
    .select({ finding: findings, vehicle: vehicles })
    .from(findings)
    .innerJoin(vehicles, eq(vehicles.id, findings.vehicleId))
    .where(scoped(findings, svc.workshop.id, eq(findings.reviewStatus, "PENDING_REVIEW")))
    .orderBy(desc(findings.createdAt));
}

export const publishFindingSchema = z.object({ advisorName: z.string().trim().default("Kirsty Brennan"), reject: z.boolean().default(false) });

export async function publishPendingFinding(svc: Svc, findingId: string, input: z.infer<typeof publishFindingSchema>) {
  const [f] = await svc.db.select().from(findings).where(scoped(findings, svc.workshop.id, eq(findings.id, findingId)));
  if (!f) throw notFound("Finding");
  if (f.reviewStatus !== "PENDING_REVIEW") throw unprocessable("ALREADY_REVIEWED", "This finding has already been reviewed.");
  if (input.reject) {
    await svc.db.update(findings).set({ status: "COMPLETED", updatedAt: now() }).where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
    return { status: "REJECTED" };
  }
  await svc.db.update(findings).set({ reviewStatus: "PUBLISHED", updatedAt: now() }).where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
  await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "FINDING_PUBLISHED",
    actorRole: "ADVISOR",
    vehicleId: f.vehicleId,
    findingId: f.id,
    signerName: input.advisorName,
    payload: { title: f.title, severity: f.severity, estimateLowCents: f.estimateLowCents, estimateHighCents: f.estimateHighCents, source: f.source },
  });
  const [v] = await svc.db.select().from(vehicles).where(and(eq(vehicles.workshopId, svc.workshop.id), eq(vehicles.id, f.vehicleId)));
  const push = f.severity === "HEALTHY_GREEN" ? null : `${v.make} ${v.model}: new ${f.severity === "URGENT_RED" ? "urgent item" : "item to watch"} — ${f.title}.`;
  const wallet = await syncWalletPass(svc.db, svc.adapters, svc.workshop, f.vehicleId, { pushMessage: push });
  return { status: "PUBLISHED", walletVersion: wallet.pass.version, garage: garageUrl(f.vehicleId) };
}
