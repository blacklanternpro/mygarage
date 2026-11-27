/**
 * Australian compliance rules as code: ACL estimate vs quote labelling, the AAAA unsafe vehicle
 * release acknowledgement, state repairer licence display and Verified Sale Pack redaction.
 * Research: docs/MARKET_RESEARCH.md §6.
 */
import { z } from "zod";
import type { Finding, RefusalAcknowledgements, Workshop } from "@/db/schema";
import { unprocessable } from "./errors";

// ─── Australian Consumer Law ───────────────────────────────────────────────

/** Exact badge text for every watch-list / Red / Amber rough price. Never retype it. */
export const ACL_ESTIMATE_LABEL =
  "Non-Binding Indicative Estimate Only — Subject to Re-Inspection & Parts Pricing" as const;

export const FIXED_QUOTE_LABEL = "Fixed Quote" as const;

export const FIXED_QUOTE_TERMS =
  "This is a fixed price for the itemised work below, including parts, labour and GST. It becomes binding when you approve it. Any extra work needs your separate authorisation before we start.";

export const ESTIMATE_EXPLAINER =
  "An estimate is our best guess from the last inspection. It is not a price. We'll re-inspect and price the parts before giving you a Fixed Quote.";

// ─── AAAA unsafe vehicle release acknowledgement ──────────────────────────

export type RefusalPointKey = keyof RefusalAcknowledgements;

interface DangerText {
  mechanical: string;
  safety: string;
}

const DANGERS_BY_CATEGORY: Record<string, DangerText> = {
  BRAKES: {
    mechanical: "Pad backing plates can grind into the discs, damaging the rotors and callipers and raising the repair cost.",
    safety: "Braking distance increases and brakes can fade or fail, especially when loaded or towing, putting you, your passengers and other road users at risk.",
  },
  TYRES: {
    mechanical: "Worn or damaged tyres can delaminate or deflate suddenly, damaging wheels and suspension.",
    safety: "Grip in the wet drops sharply and the risk of a blow-out rises, which can cause loss of control.",
  },
  SUSPENSION: {
    mechanical: "Worn suspension parts load up other components (bushes, ball joints, tyres) and accelerate their wear.",
    safety: "Handling and stability are reduced, and steering control can be lost in an emergency manoeuvre.",
  },
  STEERING: {
    mechanical: "Play in the steering can worsen quickly and damage related joints and the steering rack.",
    safety: "Steering response is unpredictable, and a joint failure can mean a complete loss of steering.",
  },
  DEFAULT: {
    mechanical: "The fault can get worse with use and damage related components.",
    safety: "The vehicle may not respond as expected, putting you, your passengers and other road users at risk.",
  },
};

export interface RefusalPoint {
  key: RefusalPointKey;
  /** Short heading for the checklist. */
  heading: string;
  /** Finding-specific statement the customer acknowledges. */
  statement: string;
}

/** The five AAAA points, written for the specific finding being declined. */
export function aaaaRefusalPoints(finding: Pick<Finding, "title" | "category" | "measurement" | "customerExplanation">): RefusalPoint[] {
  const d = DANGERS_BY_CATEGORY[finding.category] ?? DANGERS_BY_CATEGORY.DEFAULT;
  const reason = finding.measurement ? `${finding.title} (${finding.measurement}).` : `${finding.title}.`;
  return [
    {
      key: "unsafeToDrive",
      heading: "The vehicle is unsafe to drive",
      statement: "I have been told that, in the repairer's professional opinion, this vehicle is unsafe to drive in its current condition.",
    },
    {
      key: "mechanicalReason",
      heading: "The mechanical reason why",
      statement: `The reason is: ${reason}`,
    },
    {
      key: "mechanicalDangers",
      heading: "The potential mechanical dangers",
      statement: d.mechanical,
    },
    {
      key: "safetyDangers",
      heading: "The safety dangers to me and others",
      statement: d.safety,
    },
    {
      key: "repairOrTowRecommended",
      heading: "The recommendation to repair or tow",
      statement: "The repairer recommends this is repaired before the vehicle is driven again, or that it is towed. I have chosen to decline the repair against that advice.",
    },
  ];
}

export const AAAA_POINT_KEYS: RefusalPointKey[] = [
  "unsafeToDrive",
  "mechanicalReason",
  "mechanicalDangers",
  "safetyDangers",
  "repairOrTowRecommended",
];

export const unsafeRefusalSchema = z.object({
  acknowledgements: z.object({
    unsafeToDrive: z.boolean(),
    mechanicalReason: z.boolean(),
    mechanicalDangers: z.boolean(),
    safetyDangers: z.boolean(),
    repairOrTowRecommended: z.boolean(),
  }),
  signerName: z.string().trim(),
  signatureSvg: z.string(),
  reason: z.string().trim().max(500).optional(),
});
export type UnsafeRefusalInput = z.infer<typeof unsafeRefusalSchema>;

/** Server-side enforcement: all five points, a full name and a drawn signature. */
export function assertUnsafeRefusalComplete(input: UnsafeRefusalInput | undefined | null): asserts input is UnsafeRefusalInput {
  const missing: string[] = [];
  if (!input) {
    throw unprocessable("AAAA_REFUSAL_REQUIRED", "Declining a safety-critical item needs the AAAA Unsafe Vehicle Release Acknowledgement.", {
      missing: [...AAAA_POINT_KEYS, "signerName", "signature"],
    });
  }
  for (const key of AAAA_POINT_KEYS) if (input.acknowledgements?.[key] !== true) missing.push(key);
  if (!isFullName(input.signerName)) missing.push("signerName");
  if (!isDrawnSignature(input.signatureSvg)) missing.push("signature");
  if (missing.length) {
    throw unprocessable("AAAA_REFUSAL_INCOMPLETE", "All five acknowledgements, your full name and a signature are required.", { missing });
  }
}

export function isFullName(name: string | undefined | null): boolean {
  return !!name && /\S+\s+\S+/.test(name.trim()) && name.trim().length >= 4;
}

/** A drawn signature is an SVG path with a reasonable number of points. */
export function isDrawnSignature(svg: string | undefined | null): boolean {
  if (!svg) return false;
  const points = svg.match(/[ML]\s*-?\d/g);
  return svg.includes("<path") && (points?.length ?? 0) >= 6;
}

// ─── State repairer licence display ───────────────────────────────────────

type LicenceFields = Pick<Workshop, "licenceState" | "licenceType" | "licenceNumber">;

export function licenceLabel(w: LicenceFields): string {
  return `${w.licenceState} Repairer Licence ${w.licenceNumber}`;
}

export function licenceAct(w: Pick<Workshop, "licenceState">): string {
  switch (w.licenceState) {
    case "WA":
      return "Motor Vehicle Repairers Act 2003 (WA)";
    case "NSW":
      return "Motor Dealers and Repairers Act 2013 (NSW)";
    default:
      return "State motor vehicle repairer licensing";
  }
}

// ─── Verified Sale Pack redaction ─────────────────────────────────────────

export const REDACTED = "Withheld for privacy";

/** Keys never allowed in a Sale Pack export (owner PII + payment details). */
export const SALE_PACK_FORBIDDEN_KEYS = [
  "firstName",
  "lastName",
  "mobile",
  "email",
  "addressLine",
  "suburb",
  "postcode",
  "paymentNote",
  "signerName",
  "signatureSvg",
] as const;

/** Deep-strip forbidden keys from any structure destined for the Sale Pack. */
export function redactForSalePack<T>(value: T): T {
  const forbidden = new Set<string>(SALE_PACK_FORBIDDEN_KEYS);
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v instanceof Date) return v;
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([k]) => !forbidden.has(k))
          .map(([k, val]) => [k, walk(val)]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

// ─── Speech-to-text hygiene ───────────────────────────────────────────────

/** Models scheduled for API removal (26/02/2027) — never configure these. */
export const FORBIDDEN_STT_MODELS = ["whisper-1", "gpt-4o-transcribe"] as const;
export const APPROVED_STT_MODELS = ["deepgram-nova-3", "gpt-transcribe"] as const;
