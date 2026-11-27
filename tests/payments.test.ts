import { describe, expect, it } from "vitest";
import { availableRails, payToSavingCents, workshopFeeCents } from "@/domain/payments";

const shop = { paytoEnabled: true, cardEnabled: true, bnplEnabled: true, bnplMinCents: 60000 };

describe("post-1 Oct 2026 payment rules", () => {
  it("caps PayTo at A$3.50 and matches the research's A$1,200 example", () => {
    expect(workshopFeeCents("PAYTO", 120000)).toBe(350);
    expect(workshopFeeCents("CARD", 120000)).toBe(2010);
    expect(payToSavingCents(120000)).toBe(1660);
    expect(workshopFeeCents("PAYTO", 2000)).toBe(50);
  });
  it("puts PayTo first and never adds a surcharge", () => {
    const opts = availableRails(shop, 46800);
    expect(opts[0].rail).toBe("PAYTO");
    expect(opts[0].primary).toBe(true);
    for (const o of opts) expect(o.customerPaysCents).toBe(46800);
  });
  it("only offers BNPL when the owner toggle is on and the amount clears the threshold", () => {
    expect(availableRails(shop, 46800).find((o) => o.rail === "BNPL_AFTERPAY")?.available).toBe(false);
    expect(availableRails(shop, 330000).find((o) => o.rail === "BNPL_AFTERPAY")?.available).toBe(true);
    expect(availableRails({ ...shop, bnplEnabled: false }, 330000).find((o) => o.rail === "BNPL_ZIP")?.available).toBe(false);
  });
});
