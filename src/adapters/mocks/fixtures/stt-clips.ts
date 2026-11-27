/** Pre-loaded technician dictation clips for the Bay "Hold to Dictate" simulator. */
export interface SttClip {
  id: string;
  label: string;
  durationSec: number;
  /** Raw transcript as a mechanic would say it (Nova-3 smart-formatted). */
  transcript: string;
  confidence: number;
}

export const STT_CLIPS: SttClip[] = [
  {
    id: "clip-rear-shock",
    label: "Rear shock misting",
    durationSec: 6.2,
    transcript: "Left rear shock misting oil, watch it for next service, roughly 400 to 450 bucks for the pair.",
    confidence: 0.94,
  },
  {
    id: "clip-front-pads",
    label: "Front pads metal on metal",
    durationSec: 7.4,
    transcript: "Front pads are down to two mil, nearly metal on metal, needs doing today. About 420 to 520 with a machine of the rotors.",
    confidence: 0.92,
  },
  {
    id: "clip-cv-boot",
    label: "CV boot split",
    durationSec: 5.1,
    transcript: "Front left CV boot's split and flinging grease. Do it within a month, 290 to 360.",
    confidence: 0.9,
  },
  {
    id: "clip-wipers",
    label: "Wipers smearing",
    durationSec: 3.8,
    transcript: "Wiper blades are smearing, cheap fix, 45 to 60 bucks, whenever they're next in.",
    confidence: 0.95,
  },
  {
    id: "clip-tyres-good",
    label: "Tyres all good",
    durationSec: 3.2,
    transcript: "Tyres are good, six and a half mil all round, no dramas.",
    confidence: 0.97,
  },
];
