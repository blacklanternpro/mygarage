/**
 * Post-1 October 2026 payment rules (research §6): no card surcharging anywhere, PayTo first,
 * BNPL only when the owner has switched it on and the amount clears their threshold.
 * Fees below are the WORKSHOP's processing cost — never added to the customer's total.
 */
import type { Workshop } from "@/db/schema";
import type { Rail } from "@/adapters/contracts";

export interface RailMeta {
  rail: Rail;
  label: string;
  description: string;
  pct: number;
  fixedCents: number;
  capCents?: number;
  group: "PAYTO" | "CARD" | "BNPL";
}

export const RAILS: RailMeta[] = [
  { rail: "PAYTO", label: "Pay instantly via PayTo", description: "Approve in your banking app. Bank-to-bank, settles instantly.", pct: 0.01, fixedCents: 30, capCents: 350, group: "PAYTO" },
  { rail: "APPLE_PAY", label: "Apple Pay", description: "No surcharge.", pct: 0.0165, fixedCents: 30, group: "CARD" },
  { rail: "GOOGLE_PAY", label: "Google Pay", description: "No surcharge.", pct: 0.0165, fixedCents: 30, group: "CARD" },
  { rail: "CARD", label: "Debit or credit card", description: "Visa, Mastercard, eftpos, Amex. No surcharge.", pct: 0.0165, fixedCents: 30, group: "CARD" },
  { rail: "BNPL_AFTERPAY", label: "Afterpay", description: "4 fortnightly instalments. No surcharge.", pct: 0.06, fixedCents: 30, group: "BNPL" },
  { rail: "BNPL_ZIP", label: "Zip", description: "Flexible instalments. No surcharge.", pct: 0.0549, fixedCents: 30, group: "BNPL" },
];

export function railMeta(rail: Rail): RailMeta {
  const m = RAILS.find((r) => r.rail === rail);
  if (!m) throw new Error(`Unknown rail ${rail}`);
  return m;
}

/** Workshop's processing cost in cents (GST-inclusive, as published by Stripe AU). */
export function workshopFeeCents(rail: Rail, amountCents: number): number {
  const m = railMeta(rail);
  const raw = Math.round(amountCents * m.pct + m.fixedCents);
  return m.capCents != null ? Math.min(raw, m.capCents) : raw;
}

export interface RailOption extends RailMeta {
  available: boolean;
  reason: string | null;
  primary: boolean;
  workshopFeeCents: number;
  /** What the customer pays — always the quoted total. */
  customerPaysCents: number;
}

export function availableRails(w: Pick<Workshop, "paytoEnabled" | "cardEnabled" | "bnplEnabled" | "bnplMinCents">, amountCents: number): RailOption[] {
  return RAILS.map((m) => {
    let available = true;
    let reason: string | null = null;
    if (m.group === "PAYTO" && !w.paytoEnabled) {
      available = false;
      reason = "Not offered by this workshop";
    }
    if (m.group === "CARD" && !w.cardEnabled) {
      available = false;
      reason = "Not offered by this workshop";
    }
    if (m.group === "BNPL") {
      if (!w.bnplEnabled) {
        available = false;
        reason = "Not offered by this workshop";
      } else if (amountCents < w.bnplMinCents) {
        available = false;
        reason = `Available on repairs over A$${Math.round(w.bnplMinCents / 100)}`;
      }
    }
    return { ...m, available, reason, primary: m.rail === "PAYTO" && available, workshopFeeCents: workshopFeeCents(m.rail, amountCents), customerPaysCents: amountCents };
  });
}

/** Saving vs card when the customer chooses PayTo (shown on the counter console). */
export function payToSavingCents(amountCents: number): number {
  return workshopFeeCents("CARD", amountCents) - workshopFeeCents("PAYTO", amountCents);
}
