import { describe, expect, it } from "vitest";
import { formatAud, formatAudExact, formatAudRange, formatDate, formatKm, gstFromInclusive, relativeDays, totalsFromLineItems } from "@/domain/format";
import { daysUntil, nextWeekday } from "@/domain/clock";

describe("Australian formatting", () => {
  it("formats A$ with cents and GST at 1/11", () => {
    expect(formatAudExact(46800)).toBe("A$468.00");
    expect(formatAud(330000, { whole: true })).toBe("A$3,300");
    expect(formatAudRange(42000, 48000)).toBe("A$420 – A$480");
    expect(gstFromInclusive(46800)).toBe(4255);
    expect(totalsFromLineItems([{ totalCents: 19600 }, { totalCents: 24750 }, { totalCents: 2450 }])).toEqual({ totalCents: 46800, gstCents: 4255, subtotalCents: 42545 });
  });
  it("uses DD/MM/YYYY and kilometres", () => {
    expect(formatDate("2026-11-27")).toBe("27/11/2026");
    expect(formatDate(new Date("2026-11-27T20:00:00Z"))).toBe("28/11/2026"); // Perth is UTC+8
    expect(formatKm(84200)).toBe("84,200 km");
    expect(relativeDays(24)).toBe("in 24 days");
  });
  it("counts calendar days in the workshop timezone", () => {
    const from = new Date("2026-11-27T10:00:00+08:00");
    expect(daysUntil("2026-12-21", from)).toBe(24);
    expect(nextWeekday(2, from)).toBe("2026-12-01");
  });
});
