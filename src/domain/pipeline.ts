/**
 * Deferred Work ("Rainy Day") Pipeline (research §3): every open Red/Amber estimate across the
 * workshop, ranked by value and age, plus the 2-click "Fill quiet Tuesday bay" campaign.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { customers, findings, households, messages, reminders, vehicles, type Customer, type Finding, type Household, type Vehicle } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { Svc } from "./context";
import { daysUntil, isoDate, nextWeekday, now } from "./clock";
import { formatAudRange, formatShortDay } from "./format";
import { DEFAULT_BAY_HOURS } from "./categories";
import { RECOVERABLE_STATUSES } from "./status";
import { garageUrl } from "./wallet";
import { unprocessable } from "./errors";

export interface PipelineItem {
  finding: Finding;
  vehicle: Vehicle;
  customer: Customer | null;
  household: Household | null;
  valueCents: number;
  ageDays: number;
  hours: number;
  score: number;
}

export function pipelineScore(valueCents: number, ageDays: number, severity: Finding["severity"]): number {
  const severityBoost = severity === "URGENT_RED" ? 1.5 : 1;
  return Math.round((valueCents / 100) * (1 + Math.min(ageDays, 180) / 90) * severityBoost);
}

export async function getRainyDayPipeline(svc: Svc) {
  const rows = await svc.db
    .select({ finding: findings, vehicle: vehicles, customer: customers, household: households })
    .from(findings)
    .innerJoin(vehicles, eq(vehicles.id, findings.vehicleId))
    .leftJoin(customers, eq(customers.id, vehicles.primaryDriverId))
    .leftJoin(households, eq(households.id, vehicles.householdId))
    .where(
      scoped(
        findings,
        svc.workshop.id,
        ne(findings.severity, "HEALTHY_GREEN"),
        eq(findings.reviewStatus, "PUBLISHED"),
        inArray(findings.status, RECOVERABLE_STATUSES),
      ),
    );
  const today = now();
  const items: PipelineItem[] = rows
    .filter((r) => r.finding.estimateLowCents != null && r.finding.estimateHighCents != null)
    .map((r) => {
      const valueCents = Math.round(((r.finding.estimateLowCents ?? 0) + (r.finding.estimateHighCents ?? 0)) / 2);
      const ageDays = Math.max(0, -daysUntil(isoDate(r.finding.createdAt), today));
      return {
        ...r,
        valueCents,
        ageDays,
        hours: DEFAULT_BAY_HOURS[r.finding.category] ?? 1.5,
        score: pipelineScore(valueCents, ageDays, r.finding.severity),
      };
    })
    .sort((a, b) => b.score - a.score);
  const totalCents = items.reduce((s, i) => s + i.valueCents, 0);
  const red = items.filter((i) => i.finding.severity === "URGENT_RED");
  return {
    items,
    totals: {
      recoverableCents: totalCents,
      count: items.length,
      redCount: red.length,
      redCents: red.reduce((s, i) => s + i.valueCents, 0),
      declinedCount: items.filter((i) => i.finding.status === "DECLINED").length,
      vehicles: new Set(items.map((i) => i.vehicle.id)).size,
    },
  };
}

/** Greedy fill of one bay day (default 7.5 h) with the highest-ranked work, one job per vehicle. */
export function planQuietBay(items: PipelineItem[], bayHours = 7.5): PipelineItem[] {
  const chosen: PipelineItem[] = [];
  const vehiclesUsed = new Set<string>();
  let hours = 0;
  for (const item of items) {
    if (vehiclesUsed.has(item.vehicle.id) || !item.customer) continue;
    if (hours + item.hours > bayHours) continue;
    chosen.push(item);
    vehiclesUsed.add(item.vehicle.id);
    hours += item.hours;
  }
  return chosen;
}

export function campaignSms(workshopName: string, advisorFirstName: string, item: Pick<PipelineItem, "finding" | "vehicle" | "customer">, dateIso: string): string {
  const est =
    item.finding.estimateLowCents != null && item.finding.estimateHighCents != null
      ? ` Non-binding est. ${formatAudRange(item.finding.estimateLowCents, item.finding.estimateHighCents)}, confirmed on inspection.`
      : "";
  return `Hi ${item.customer?.firstName ?? "there"}, it's ${advisorFirstName} at ${workshopName}. We've got a bay free ${formatShortDay(dateIso)}. Your ${item.vehicle.model}'s ${item.finding.title.toLowerCase()} is on your watch-list — want us to sort it then?${est} Reply YES or book: ${garageUrl(item.vehicle.id)}`;
}

export const campaignSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  findingIds: z.array(z.string().uuid()).min(1, "Pick at least one job.").max(20),
  advisorName: z.string().trim().default("Kirsty Brennan"),
});

export function defaultQuietDay(): string {
  return nextWeekday(2); // Tuesday
}

export async function launchFillBayCampaign(svc: Svc, input: z.infer<typeof campaignSchema>) {
  const date = input.date ?? defaultQuietDay();
  const { items } = await getRainyDayPipeline(svc);
  const picked = items.filter((i) => input.findingIds.includes(i.finding.id));
  if (!picked.length) throw unprocessable("NOTHING_TO_SEND", "Those jobs are no longer open.");
  const key = `fill-bay-${date}`;
  const advisorFirst = input.advisorName.split(" ")[0];
  const sent = [];
  for (const item of picked) {
    if (!item.customer) continue;
    const body = campaignSms(svc.workshop.name, advisorFirst, item, date);
    const sms = await svc.adapters.sms.send({ to: item.customer.mobile, senderId: svc.workshop.smsSenderId, body, tag: key });
    await svc.db.insert(reminders).values({
      workshopId: svc.workshop.id,
      vehicleId: item.vehicle.id,
      findingId: item.finding.id,
      customerId: item.customer.id,
      kind: "CAMPAIGN",
      channel: "SMS",
      scheduledFor: now(),
      status: "SENT",
      message: body,
      campaignKey: key,
    });
    await svc.db.insert(messages).values({
      workshopId: svc.workshop.id,
      vehicleId: item.vehicle.id,
      authorRole: "ADVISOR",
      authorName: input.advisorName,
      body,
      channel: "SMS",
    });
    sent.push({ findingId: item.finding.id, to: item.customer.mobile, messageId: sms.messageId, segments: sms.segments, costCents: sms.costCents });
  }
  return { campaignKey: key, date, sent, totalCostCents: sent.reduce((s, x) => s + x.costCents, 0) };
}

export async function campaignHistory(svc: Svc) {
  return svc.db
    .select()
    .from(reminders)
    .where(and(eq(reminders.workshopId, svc.workshop.id), eq(reminders.kind, "CAMPAIGN")));
}
