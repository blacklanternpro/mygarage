import { describe, expect, it } from "vitest";
import {
  ACL_ESTIMATE_LABEL,
  AAAA_POINT_KEYS,
  FORBIDDEN_STT_MODELS,
  aaaaRefusalPoints,
  assertUnsafeRefusalComplete,
  licenceLabel,
  redactForSalePack,
} from "@/domain/compliance";
import { DomainError } from "@/domain/errors";
import { FULL_REFUSAL } from "./helpers";
import { MockVoiceSttAdapter } from "@/adapters/mocks/others";

describe("ACL estimate labelling", () => {
  it("uses the exact non-binding wording", () => {
    expect(ACL_ESTIMATE_LABEL).toBe("Non-Binding Indicative Estimate Only — Subject to Re-Inspection & Parts Pricing");
  });
});

describe("AAAA unsafe vehicle refusal", () => {
  const finding = { title: "Front brake pads worn to 2 mm", category: "BRAKES", measurement: "2 mm left", customerExplanation: "" };
  it("produces exactly five finding-specific points", () => {
    const pts = aaaaRefusalPoints(finding);
    expect(pts.map((p) => p.key)).toEqual(AAAA_POINT_KEYS);
    expect(pts[1].statement).toContain("Front brake pads worn to 2 mm (2 mm left)");
    expect(pts[4].statement.toLowerCase()).toContain("towed");
  });
  it("rejects missing, partial or unsigned refusals with 422", () => {
    const attempt = (input: unknown) => {
      try {
        assertUnsafeRefusalComplete(input as never);
        return null;
      } catch (e) {
        return e as DomainError;
      }
    };
    expect(attempt(null)?.status).toBe(422);
    const partial = attempt({ ...FULL_REFUSAL, acknowledgements: { ...FULL_REFUSAL.acknowledgements, safetyDangers: false } });
    expect(partial?.status).toBe(422);
    expect((partial?.details as { missing: string[] }).missing).toEqual(["safetyDangers"]);
    expect((attempt({ ...FULL_REFUSAL, signerName: "Sam" })?.details as { missing: string[] }).missing).toContain("signerName");
    expect((attempt({ ...FULL_REFUSAL, signatureSvg: "" })?.details as { missing: string[] }).missing).toContain("signature");
    expect(attempt(FULL_REFUSAL)).toBeNull();
  });
});

describe("licence + sale pack + STT hygiene", () => {
  it("labels the WA licence", () => {
    expect(licenceLabel({ licenceState: "WA", licenceType: "MRB", licenceNumber: "MRB8421" })).toBe("WA Repairer Licence MRB8421");
  });
  it("strips owner PII and payment details deeply", () => {
    const out = redactForSalePack({ owner: { firstName: "Bec", lastName: "Hartley", mobile: "0491 570 110", addressLine: "27 Wattle Bend" }, records: [{ invoiceNumber: "MD-1", paymentNote: "Visa 4417", totalCents: 100 }], vin: "X" });
    const json = JSON.stringify(out);
    for (const pii of ["Bec", "Hartley", "0491", "Wattle", "4417"]) expect(json).not.toContain(pii);
    expect(json).toContain("MD-1");
    expect(json).toContain('"vin":"X"');
  });
  it("never configures a deprecated STT model", () => {
    const stt = new MockVoiceSttAdapter({ db: null as never, workshopId: null });
    expect(FORBIDDEN_STT_MODELS).not.toContain(stt.info.liveProvider);
    expect(stt.info.liveProvider).toMatch(/Nova-3/);
  });
});
