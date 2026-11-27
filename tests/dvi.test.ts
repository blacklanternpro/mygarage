import { describe, expect, it } from "vitest";
import { structureDictation } from "@/domain/dvi";
import { STT_CLIPS } from "@/adapters/mocks/fixtures/stt-clips";

const clip = (id: string) => STT_CLIPS.find((c) => c.id === id)!.transcript;

describe("voice → plain-English finding", () => {
  it("handles the research's example dictation", () => {
    const d = structureDictation(clip("clip-rear-shock"));
    expect(d.severity).toBe("WATCH_AMBER");
    expect(d.category).toBe("SUSPENSION");
    expect(d.position).toBe("rear");
    expect(d.title).toBe("Rear shock absorbers misting oil");
    expect(d.customerExplanation).toMatch(/Plan to sort them at your next service\./);
    expect(d.horizonText).toBe("At your next service");
    expect([d.estimateLowCents, d.estimateHighCents]).toEqual([40000, 45000]);
    expect(d.customerExplanation).toMatch(/leak a fine film of oil/);
    expect(d.customerExplanation).not.toMatch(/bucks|misting/);
  });
  it("escalates metal-on-metal pads to Red with mm parsed from words", () => {
    const d = structureDictation(clip("clip-front-pads"));
    expect(d.severity).toBe("URGENT_RED");
    expect(d.category).toBe("BRAKES");
    expect(d.measurement).toBe("2 mm");
    expect(d.estimateLowCents).toBe(42000);
  });
  it("recognises a healthy check", () => {
    const d = structureDictation(clip("clip-tyres-good"));
    expect(d.severity).toBe("HEALTHY_GREEN");
    expect(d.measurement).toBe("6.5 mm");
    expect(d.estimateLowCents).toBeNull();
  });
  it("parses short horizons and cheap ranges", () => {
    expect(structureDictation(clip("clip-cv-boot")).horizonText).toBe("Within a month");
    expect(structureDictation(clip("clip-wipers")).estimateHighCents).toBe(6000);
  });
});
