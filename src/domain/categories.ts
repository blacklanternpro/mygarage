/** Finding categories shared by the bridge, bay DVI, pipeline and diagrams. */

export const CATEGORY_LABELS: Record<string, string> = {
  BRAKES: "Brakes",
  TYRES: "Tyres & wheels",
  SUSPENSION: "Suspension",
  STEERING: "Steering",
  BATTERY: "Battery & charging",
  ENGINE: "Engine",
  COOLING: "Cooling",
  DRIVELINE: "Driveline",
  TRANSMISSION: "Transmission & clutch",
  LIGHTS: "Lights",
  VISIBILITY: "Wipers & glass",
  EXHAUST: "Exhaust",
  SERVICE: "Scheduled service",
  BODY: "Body & safety",
};

/** Typical labour hours used by the "Fill quiet bay" planner (not shown as a price). */
export const DEFAULT_BAY_HOURS: Record<string, number> = {
  BRAKES: 1.5,
  TYRES: 1,
  SUSPENSION: 2,
  STEERING: 2,
  BATTERY: 0.5,
  ENGINE: 2.5,
  COOLING: 2,
  DRIVELINE: 1.5,
  TRANSMISSION: 4,
  LIGHTS: 0.5,
  VISIBILITY: 0.3,
  EXHAUST: 1.5,
  SERVICE: 4.5,
  BODY: 1,
};

export type DiagramKind = "BRAKE_PAD" | "SHOCK" | "BATTERY" | "TYRE" | "BELT" | "FLUID" | "GENERIC";

export const DIAGRAM_FOR_CATEGORY: Record<string, DiagramKind> = {
  BRAKES: "BRAKE_PAD",
  SUSPENSION: "SHOCK",
  BATTERY: "BATTERY",
  TYRES: "TYRE",
  SERVICE: "BELT",
  ENGINE: "FLUID",
  COOLING: "FLUID",
  TRANSMISSION: "FLUID",
};

const RULES: [RegExp, string][] = [
  [/\b(pad|pads|rotor|rotors|disc|discs|caliper|calliper|brake|shoes?)\b/i, "BRAKES"],
  [/\b(tyre|tyres|tire|tires|tread|wheel alignment|alignment|rim)\b/i, "TYRES"],
  [/\b(shock|shocks|strut|struts|spring|springs|bush|bushes|bushing|control arm|sway bar|link)\b/i, "SUSPENSION"],
  [/\b(tie rod|rack|steering|ball joint)\b/i, "STEERING"],
  [/\b(battery|alternator|cca|cranking)\b/i, "BATTERY"],
  [/\b(cv|boot|tailshaft|uni joint|diff|differential|wheel bearing)\b/i, "DRIVELINE"],
  [/\b(clutch|gearbox|transmission|trans fluid|transfer case)\b/i, "TRANSMISSION"],
  [/\b(coolant|radiator|water pump|thermostat|hose)\b/i, "COOLING"],
  [/\b(wiper|wipers|windscreen|glass)\b/i, "VISIBILITY"],
  [/\b(globe|bulb|headlight|tail light|indicator)\b/i, "LIGHTS"],
  [/\b(exhaust|muffler|dpf)\b/i, "EXHAUST"],
  [/\b(major service|logbook|timing|drive belt|accessory belt|service due)\b/i, "SERVICE"],
  [/\b(oil|gasket|rocker|seal|leak|engine|injector|filter)\b/i, "ENGINE"],
];

export function inferCategory(text: string): string {
  for (const [re, cat] of RULES) if (re.test(text)) return cat;
  return "BODY";
}
