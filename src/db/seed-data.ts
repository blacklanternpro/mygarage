/**
 * Demo world for Stage 1. ALL seed/demo content lives here (plus adapter fixtures).
 * Dates are relative to "now" so the demo always looks current (service due in 24 days, etc.).
 * IDs are deterministic (stableId) so demo URLs survive a reset.
 *
 * Contact details use ACMA-reserved fictitious numbers (0491 570 xxx, 08 5550 xxxx) and the
 * reserved .example domain. ABN and VINs are fictional.
 */
import type { LineItem, RefusalAcknowledgements } from "./schema";
import { stableId } from "@/domain/ids";
import { addDaysIso } from "@/domain/clock";

export const DEMO_WORKSHOP_KEY = "workshop:south-west-mechanical";
export const DEMO_HOUSEHOLD_KEY = "household:hartley";

export const id = (key: string) => stableId(key);

// ─── Line-item helpers ─────────────────────────────────────────────────────

export const LABOUR_RATE_CENTS = 16500; // A$165.00/h inc. GST

export function part(key: string, description: string, qty: number, unitCents: number, partNumber?: string): LineItem {
  return { id: key, kind: "PART", description, qty, unitCents, totalCents: Math.round(qty * unitCents), partNumber };
}
export function labour(key: string, description: string, hours: number, rateCents = LABOUR_RATE_CENTS): LineItem {
  return { id: key, kind: "LABOUR", description, qty: 1, hours, rateCents, unitCents: Math.round(hours * rateCents), totalCents: Math.round(hours * rateCents) };
}
export function fee(key: string, description: string, cents: number, qty = 1): LineItem {
  return { id: key, kind: "FEE", description, qty, unitCents: cents, totalCents: cents * qty };
}

// ─── Workshop ──────────────────────────────────────────────────────────────

export const WORKSHOP = {
  key: DEMO_WORKSHOP_KEY,
  slug: "south-west-mechanical",
  name: "South West Mechanical & 4x4",
  ownerNames: "Dave & Kirsty Brennan",
  staffCount: 6,
  addressLine: "Unit 3, 12 Forge Way",
  suburb: "Australind",
  state: "WA",
  postcode: "6233",
  phone: "(08) 5550 4812",
  email: "bookings@southwestmech.example",
  abn: "12 345 678 901",
  licenceState: "WA",
  licenceType: "MRB",
  licenceNumber: "MRB8421",
  wms: "MechanicDesk",
  brandPrimary: "#1D4F66",
  brandAccent: "#E9E4D8",
  smsSenderId: "SWMech4x4",
  hoursText: "Mon–Fri 7:30 am – 5:00 pm · Sat 8:00 am – 12:00 pm",
  labourRateCents: LABOUR_RATE_CENTS,
  bayCount: 4,
  paytoEnabled: true,
  cardEnabled: true,
  bnplEnabled: true,
  bnplMinCents: 60000,
};

export const STAFF = {
  owner: "Dave Brennan",
  advisor: "Kirsty Brennan",
  techs: ["Jordan Pike", "Mia Castellano", "Tom Reid"],
  apprentice: "Lachie O'Connor",
};

// ─── Hartley household (the hero household) ────────────────────────────────

export const HARTLEY = {
  key: DEMO_HOUSEHOLD_KEY,
  name: "Hartley household",
  customers: [
    {
      key: "customer:bec-hartley",
      firstName: "Bec",
      lastName: "Hartley",
      mobile: "0491 570 110",
      email: "bec.hartley@example.com",
      addressLine: "27 Wattle Bend",
      suburb: "Australind",
      postcode: "6233",
      role: "PRIMARY",
    },
    {
      key: "customer:sam-hartley",
      firstName: "Sam",
      lastName: "Hartley",
      mobile: "0491 570 111",
      email: "sam.hartley@example.com",
      addressLine: "27 Wattle Bend",
      suburb: "Australind",
      postcode: "6233",
      role: "MEMBER",
    },
  ],
};

export interface SeedFinding {
  key: string;
  severity: "URGENT_RED" | "WATCH_AMBER" | "HEALTHY_GREEN";
  category: string;
  title: string;
  customerExplanation: string;
  technicianNote?: string;
  measurement?: string;
  diagram?: string;
  horizonText?: string;
  horizonKm?: number;
  horizonDays?: number;
  low?: number;
  high?: number;
  safetyCritical?: boolean;
  status?: "OPEN" | "QUOTED" | "DECLINED" | "PLANNED";
}

export interface SeedServiceRecord {
  key: string;
  invoiceNumber: string;
  daysAgo: number;
  odometerKm: number;
  summary: string;
  technician: string;
  lineItems: LineItem[];
  paymentNote: string;
}

export interface SeedVehicle {
  key: string;
  rego: string;
  regoState: string;
  regoExpiryDays: number;
  make: string;
  model: string;
  variant: string;
  year: number;
  vin: string;
  colour: string;
  bodyType: string;
  engine: string;
  transmission: string;
  odometerKm: number;
  avgKmPerDay: number;
  nextServiceDays: number | null;
  nextServiceKm: number | null;
  nickname?: string;
  primaryDriverKey: string;
  inspection: { key: string; daysAgo: number; odometerKm: number; technician: string; summary: string; serviceRecordKey?: string };
  findings: SeedFinding[];
  serviceRecords: SeedServiceRecord[];
}

const GREEN = (key: string, category: string, title: string, customerExplanation: string, measurement?: string): SeedFinding => ({
  key,
  severity: "HEALTHY_GREEN",
  category,
  title,
  customerExplanation,
  measurement,
});

export const HILUX: SeedVehicle = {
  key: "vehicle:hilux",
  rego: "1HBC 429",
  regoState: "WA",
  regoExpiryDays: 188,
  make: "Toyota",
  model: "HiLux",
  variant: "SR5 4x4 Double Cab",
  year: 2021,
  vin: "MR0HA3CD100512345",
  colour: "Glacier White",
  bodyType: "Dual cab ute",
  engine: "2.8 L turbo-diesel (1GD-FTV)",
  transmission: "6-speed automatic",
  odometerKm: 84_200,
  avgKmPerDay: 58,
  nextServiceDays: 96,
  nextServiceKm: 90_000,
  nickname: "Sam's ute",
  primaryDriverKey: "customer:sam-hartley",
  inspection: {
    key: "inspection:hilux-latest",
    daysAgo: 6,
    odometerKm: 84_200,
    technician: "Jordan Pike",
    summary: "10,000 km logbook service with full safety inspection.",
    serviceRecordKey: "sr:hilux-30412",
  },
  findings: [
    {
      key: "finding:hilux-front-pads",
      severity: "URGENT_RED",
      category: "BRAKES",
      title: "Front brake pads worn to 2 mm",
      customerExplanation:
        "Your front brake pads are down to 2 mm. Below 3 mm they stop protecting the discs and your stopping distance gets longer, especially loaded or towing. Please book them in before you drive much further.",
      technicianNote: "LF/RF pads 2 mm. Rotors 27.4 mm (min 26.0) — machine OK. Recommend pads + machine rotors.",
      measurement: "2 mm left (new: 12 mm)",
      diagram: "BRAKE_PAD",
      low: 42000,
      high: 52000,
      safetyCritical: true,
      status: "QUOTED",
    },
    {
      key: "finding:hilux-battery",
      severity: "WATCH_AMBER",
      category: "BATTERY",
      title: "Battery weakening before winter",
      customerExplanation:
        "Your battery tested at 67% of its rated cranking power. It's fine for now, but cold mornings are when tired batteries give up. Worth replacing before June.",
      technicianNote: "11.9 V at rest, 480 CCA of 720 rated. Terminals clean.",
      measurement: "67% health · 480 of 720 CCA",
      diagram: "BATTERY",
      horizonText: "Before winter (by June)",
      horizonDays: 186,
      low: 28900,
      high: 34900,
    },
    {
      key: "finding:hilux-rear-shocks",
      severity: "WATCH_AMBER",
      category: "SUSPENSION",
      title: "Rear shock absorbers weeping oil",
      customerExplanation:
        "Both rear shock absorbers are misting oil. They still work, but they'll wear faster with towing and corrugations. Plan to replace the pair at your next service.",
      technicianNote: "LR/RR shocks misting, no dampening loss on bounce test yet.",
      measurement: "Light oil misting, both rear",
      diagram: "SHOCK",
      horizonText: "At your next service (~5,800 km)",
      horizonKm: 90_000,
      low: 42000,
      high: 48000,
    },
    GREEN("finding:hilux-tyres", "TYRES", "Tyres", "All-terrain tyres have plenty of life left.", "6.5 mm tread all round"),
    GREEN("finding:hilux-rear-brakes", "BRAKES", "Rear brakes", "Rear drum brakes are within spec and adjusted.", "3.8 mm linings"),
    GREEN("finding:hilux-steering", "STEERING", "Steering & ball joints", "No play in the steering or ball joints."),
    GREEN("finding:hilux-cv", "DRIVELINE", "CV boots & tailshaft", "Boots are intact and the tailshaft is greased."),
    GREEN("finding:hilux-coolant", "COOLING", "Coolant & hoses", "Coolant is clean and hoses are firm."),
    GREEN("finding:hilux-lights", "LIGHTS", "Lights & indicators", "All lights and indicators working."),
    GREEN("finding:hilux-wipers", "VISIBILITY", "Wipers & washers", "Wipers clear cleanly; washer fluid topped up."),
    GREEN("finding:hilux-exhaust", "EXHAUST", "Exhaust & DPF", "No leaks. DPF regenerating normally."),
    GREEN("finding:hilux-diffs", "DRIVELINE", "Diff & transfer case oils", "Levels correct, no leaks."),
    GREEN("finding:hilux-trans", "TRANSMISSION", "Transmission fluid", "Level and condition fine."),
  ],
  serviceRecords: [
    {
      key: "sr:hilux-30412",
      invoiceNumber: "MD-30412",
      daysAgo: 6,
      odometerKm: 84_200,
      summary: "10,000 km logbook service + safety inspection",
      technician: "Jordan Pike",
      paymentNote: "Paid — EFTPOS Mastercard ending 2291",
      lineItems: [
        labour("l1", "Logbook service labour", 1.5),
        part("p1", "Engine oil 5W-30 diesel (7.5 L)", 1, 9600),
        part("p2", "Oil filter", 1, 2450),
        part("p3", "Fuel filter", 1, 6800),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
    {
      key: "sr:hilux-28977",
      invoiceNumber: "MD-28977",
      daysAgo: 190,
      odometerKm: 74_120,
      summary: "Logbook service",
      technician: "Mia Castellano",
      paymentNote: "Paid — EFTPOS Mastercard ending 2291",
      lineItems: [
        labour("l1", "Logbook service labour", 1.5),
        part("p1", "Engine oil 5W-30 diesel (7.5 L)", 1, 9600),
        part("p2", "Oil filter", 1, 2450),
        part("p3", "Engine air filter", 1, 5200),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
    {
      key: "sr:hilux-27106",
      invoiceNumber: "MD-27106",
      daysAgo: 372,
      odometerKm: 64_350,
      summary: "Logbook service + 4 × all-terrain tyres",
      technician: "Jordan Pike",
      paymentNote: "Paid — Visa ending 4417",
      lineItems: [
        labour("l1", "Logbook service labour", 1.5),
        labour("l2", "Fit & balance 4 tyres", 1),
        part("p1", "All-terrain tyre 265/65R17", 4, 32900),
        part("p2", "Engine oil 5W-30 diesel (7.5 L)", 1, 9200),
        part("p3", "Oil filter", 1, 2450),
        fee("f1", "Wheel balance & tyre disposal", 1800, 4),
        fee("f2", "Environmental levy & consumables", 1250),
      ],
    },
    {
      key: "sr:hilux-25230",
      invoiceNumber: "MD-25230",
      daysAgo: 560,
      odometerKm: 54_010,
      summary: "Logbook service",
      technician: "Tom Reid",
      paymentNote: "Paid — EFTPOS Mastercard ending 2291",
      lineItems: [
        labour("l1", "Logbook service labour", 1.5),
        part("p1", "Engine oil 5W-30 diesel (7.5 L)", 1, 8900),
        part("p2", "Oil filter", 1, 2450),
        fee("f1", "Environmental levy & consumables", 1200),
      ],
    },
  ],
};

export const CX5: SeedVehicle = {
  key: "vehicle:cx5",
  rego: "1GYT 812",
  regoState: "WA",
  regoExpiryDays: 41,
  make: "Mazda",
  model: "CX-5",
  variant: "Touring AWD",
  year: 2019,
  vin: "JM0KF4W7A00123456",
  colour: "Soul Red Crystal",
  bodyType: "SUV",
  engine: "2.5 L petrol (SkyActiv-G)",
  transmission: "6-speed automatic",
  odometerKm: 67_500,
  avgKmPerDay: 32,
  nextServiceDays: 24,
  nextServiceKm: 70_000,
  nickname: "Bec's car",
  primaryDriverKey: "customer:bec-hartley",
  inspection: {
    key: "inspection:cx5-latest",
    daysAgo: 158,
    odometerKm: 60_140,
    technician: "Mia Castellano",
    summary: "60,000 km logbook service with full inspection. Everything checked and healthy.",
    serviceRecordKey: "sr:cx5-29120",
  },
  findings: [
    GREEN("finding:cx5-brakes", "BRAKES", "Brakes", "Front and rear pads have plenty left.", "Front 8 mm · rear 7 mm"),
    GREEN("finding:cx5-tyres", "TYRES", "Tyres", "Good tread, even wear.", "Front 6.0 mm · rear 4.5 mm"),
    GREEN("finding:cx5-battery", "BATTERY", "Battery", "Strong battery.", "88% health"),
    GREEN("finding:cx5-suspension", "SUSPENSION", "Suspension & steering", "No wear or play found."),
    GREEN("finding:cx5-lights", "LIGHTS", "Lights & indicators", "All working."),
    GREEN("finding:cx5-wipers", "VISIBILITY", "Wipers & washers", "Clearing well."),
    GREEN("finding:cx5-coolant", "COOLING", "Coolant & hoses", "Clean and full."),
    GREEN("finding:cx5-exhaust", "EXHAUST", "Exhaust", "No leaks or noise."),
    GREEN("finding:cx5-cv", "DRIVELINE", "CV boots & driveline", "Boots intact."),
  ],
  serviceRecords: [
    {
      key: "sr:cx5-29120",
      invoiceNumber: "MD-29120",
      daysAgo: 158,
      odometerKm: 60_140,
      summary: "60,000 km logbook service",
      technician: "Mia Castellano",
      paymentNote: "Paid — Visa ending 4417",
      lineItems: [
        labour("l1", "Logbook service labour", 1.8),
        part("p1", "Engine oil 0W-20 full synthetic (4.8 L)", 1, 8450),
        part("p2", "Oil filter", 1, 2290),
        part("p3", "Spark plug (iridium)", 4, 2450),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
    {
      key: "sr:cx5-27010",
      invoiceNumber: "MD-27010",
      daysAgo: 340,
      odometerKm: 52_600,
      summary: "Logbook service",
      technician: "Tom Reid",
      paymentNote: "Paid — Visa ending 4417",
      lineItems: [
        labour("l1", "Logbook service labour", 1.2),
        part("p1", "Engine oil 0W-20 full synthetic (4.8 L)", 1, 8450),
        part("p2", "Oil filter", 1, 2290),
        part("p3", "Cabin air filter", 1, 3900),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
  ],
};

export const RANGER: SeedVehicle = {
  key: "vehicle:ranger",
  rego: "1FTR 209",
  regoState: "WA",
  regoExpiryDays: 150,
  make: "Ford",
  model: "Ranger",
  variant: "XLT 3.2 4x4 Double Cab",
  year: 2016,
  vin: "MPBUMFF60GX123456",
  colour: "Cool White",
  bodyType: "Dual cab ute",
  engine: "3.2 L five-cylinder turbo-diesel",
  transmission: "6-speed automatic",
  odometerKm: 142_800,
  avgKmPerDay: 45,
  nextServiceDays: 38,
  nextServiceKm: 150_000,
  nickname: "The old Ranger",
  primaryDriverKey: "customer:sam-hartley",
  inspection: {
    key: "inspection:ranger-latest",
    daysAgo: 60,
    odometerKm: 140_050,
    technician: "Tom Reid",
    summary: "140,000 km logbook service and inspection.",
    serviceRecordKey: "sr:ranger-29940",
  },
  findings: [
    {
      key: "finding:ranger-major-150k",
      severity: "WATCH_AMBER",
      category: "SERVICE",
      title: "150,000 km major service coming up",
      customerExplanation:
        "Your Ranger reaches its 150,000 km major service soon. It covers the accessory drive belt, coolant, transmission fluid, diff and transfer-case oils, fuel filter and a full inspection. The 3.2 has a timing chain, so there's no timing belt to replace.",
      technicianNote: "Accessory drive belt showing light cracking — replace at 150k. Cam drive is chain (no TB).",
      measurement: "142,800 of 150,000 km",
      diagram: "BELT",
      horizonText: "In about 7,200 km (around 5 months)",
      horizonKm: 150_000,
      low: 118000,
      high: 142000,
    },
    GREEN("finding:ranger-brakes", "BRAKES", "Brakes", "Pads replaced last year; plenty left.", "Front 6 mm · rear 5 mm"),
    GREEN("finding:ranger-tyres", "TYRES", "Tyres", "Even wear.", "5.0 mm tread"),
    GREEN("finding:ranger-battery", "BATTERY", "Battery", "Healthy for now.", "79% health"),
    GREEN("finding:ranger-steering", "STEERING", "Steering & suspension", "No play or leaks."),
    GREEN("finding:ranger-lights", "LIGHTS", "Lights & indicators", "All working."),
    GREEN("finding:ranger-cooling", "COOLING", "Coolant & hoses", "Due for replacement at 150k; fine until then."),
  ],
  serviceRecords: [
    {
      key: "sr:ranger-29940",
      invoiceNumber: "MD-29940",
      daysAgo: 60,
      odometerKm: 140_050,
      summary: "140,000 km logbook service",
      technician: "Tom Reid",
      paymentNote: "Paid — EFTPOS Mastercard ending 2291",
      lineItems: [
        labour("l1", "Logbook service labour", 1.6),
        part("p1", "Engine oil 5W-30 diesel (9 L)", 1, 11800),
        part("p2", "Oil filter", 1, 2600),
        part("p3", "Fuel filter", 1, 7400),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
    {
      key: "sr:ranger-28102",
      invoiceNumber: "MD-28102",
      daysAgo: 245,
      odometerKm: 130_400,
      summary: "Logbook service + front brake pads",
      technician: "Jordan Pike",
      paymentNote: "Paid — EFTPOS Mastercard ending 2291",
      lineItems: [
        labour("l1", "Logbook service labour", 1.6),
        labour("l2", "Replace front pads, machine rotors", 1.5),
        part("p1", "Front disc brake pad set, 4WD heavy-duty", 1, 18900),
        part("p2", "Engine oil 5W-30 diesel (9 L)", 1, 11800),
        part("p3", "Oil filter", 1, 2600),
        fee("f1", "Environmental levy & consumables", 1250),
      ],
    },
  ],
};

export const HARTLEY_VEHICLES = [HILUX, CX5, RANGER];

// ─── Fixed quotes, mod-quote thread & messages for the Hartleys ────────────

export const BRAKE_QUOTE = {
  key: "quote:hilux-brakes",
  quoteNumber: "Q-24117",
  vehicleKey: HILUX.key,
  title: "Front brake pads & disc machining",
  findingKeys: ["finding:hilux-front-pads"],
  issuedDaysAgo: 6,
  validDays: 14,
  lineItems: [
    part("q1", "Front disc brake pad set, 4WD heavy-duty", 1, 19600),
    labour("q2", "Replace front pads, machine both front rotors", 1.5),
    fee("q3", "Brake fluid top-up & workshop consumables", 2450),
  ],
};

export const LIFT_QUOTE = {
  key: "quote:hilux-lift",
  quoteNumber: "Q-24109",
  vehicleKey: HILUX.key,
  title: '2" (50 mm) suspension lift, fitted',
  findingKeys: [] as string[],
  issuedDaysAgo: 3,
  validDays: 21,
  lineItems: [
    part("m1", '2" lift kit: coil springs, leaf packs, 4 × nitro gas shocks', 1, 239000),
    labour("m2", "Fit lift kit front & rear", 4.5),
    fee("m3", "Four-wheel alignment", 12900),
    fee("m4", "Headlight re-aim & road test", 3850),
  ],
};

export const TYRE_QUOTE_HISTORIC = {
  key: "quote:hilux-tyres-2025",
  quoteNumber: "Q-23552",
  vehicleKey: HILUX.key,
  title: "4 × all-terrain tyres, fitted & balanced",
  findingKeys: [] as string[],
  issuedDaysAgo: 374,
  approvedDaysAgo: 373,
  validDays: 14,
  lineItems: [
    part("t1", "All-terrain tyre 265/65R17", 4, 32900),
    labour("t2", "Fit & balance 4 tyres", 1),
    fee("t3", "Wheel balance & tyre disposal", 1800, 4),
  ],
};

export const LIFT_REQUEST = {
  key: "mod:hilux-lift",
  vehicleKey: HILUX.key,
  customerKey: "customer:sam-hartley",
  modType: "SUSPENSION_LIFT",
  title: '2" suspension lift',
  description:
    "Looking at a 2 inch lift for the HiLux. Mostly weekend beach runs and towing a 1.8 t camper down to Margaret River a few times a year. Want it to stay comfortable on the highway.",
  usage: "Daily driver + weekend 4WD, towing a 1.8 t camper",
  budgetBand: "A$2,500 – A$4,000",
  daysAgo: 5,
  status: "QUOTED",
};

export interface SeedMessage {
  key: string;
  vehicleKey: string;
  thread: "VEHICLE" | "MOD";
  modKey?: string;
  quoteKey?: string;
  authorRole: "CUSTOMER" | "ADVISOR" | "TECH" | "SYSTEM";
  authorName: string;
  body: string;
  hoursAgo: number;
  channel?: "APP" | "SMS";
}

export const HARTLEY_MESSAGES: SeedMessage[] = [
  {
    key: "msg:hilux-1",
    vehicleKey: HILUX.key,
    thread: "VEHICLE",
    authorRole: "ADVISOR",
    authorName: STAFF.advisor,
    body: "Hi Sam, the HiLux is ready to collect. Jordan found the front pads down to 2 mm, so I've sent you a fixed quote. We can fit them Tuesday morning if that suits.",
    hoursAgo: 6 * 24 - 2,
    quoteKey: BRAKE_QUOTE.key,
  },
  {
    key: "msg:lift-1",
    vehicleKey: HILUX.key,
    thread: "MOD",
    modKey: LIFT_REQUEST.key,
    authorRole: "CUSTOMER",
    authorName: "Sam Hartley",
    body: LIFT_REQUEST.description,
    hoursAgo: 5 * 24,
  },
  {
    key: "msg:lift-2",
    vehicleKey: HILUX.key,
    thread: "MOD",
    modKey: LIFT_REQUEST.key,
    authorRole: "ADVISOR",
    authorName: STAFF.advisor,
    body: "Thanks Sam. For that use we'd suggest a 2\" kit with constant-load rear leaf packs to carry the camper. We'll check it against the WA Department of Transport modification rules before fitting and confirm in writing.",
    hoursAgo: 4 * 24,
  },
  {
    key: "msg:lift-3",
    vehicleKey: HILUX.key,
    thread: "MOD",
    modKey: LIFT_REQUEST.key,
    quoteKey: LIFT_QUOTE.key,
    authorRole: "ADVISOR",
    authorName: STAFF.advisor,
    body: "Fixed quote attached. It includes new shocks all round, so it would also take care of the weeping rear shocks on your watch list.",
    hoursAgo: 3 * 24,
  },
  {
    key: "msg:lift-4",
    vehicleKey: HILUX.key,
    thread: "MOD",
    modKey: LIFT_REQUEST.key,
    authorRole: "CUSTOMER",
    authorName: "Sam Hartley",
    body: "Legend, thanks. Could we do it the same day as the brakes?",
    hoursAgo: 2 * 24,
  },
];

// ─── Supporting households (rainy-day pipeline, triage inbox, vault) ───────

export interface SupportHousehold {
  key: string;
  name: string;
  firstName: string;
  lastName: string;
  mobile: string;
  vehicle: Omit<SeedVehicle, "findings" | "serviceRecords" | "inspection" | "primaryDriverKey">;
  inspectionDaysAgo: number;
  findings: SeedFinding[];
}

const sv = (
  key: string,
  rego: string,
  make: string,
  model: string,
  variant: string,
  year: number,
  vin: string,
  colour: string,
  bodyType: string,
  odometerKm: number,
  avgKmPerDay: number,
): SupportHousehold["vehicle"] => ({
  key,
  rego,
  regoState: "WA",
  regoExpiryDays: 30 + (odometerKm % 300),
  make,
  model,
  variant,
  year,
  vin,
  colour,
  bodyType,
  engine: "—",
  transmission: "Automatic",
  odometerKm,
  avgKmPerDay,
  nextServiceDays: 20 + (odometerKm % 150),
  nextServiceKm: Math.ceil((odometerKm + 2000) / 10000) * 10000,
});

const amber = (key: string, category: string, title: string, explanation: string, measurement: string, low: number, high: number, horizonText: string): SeedFinding => ({
  key,
  severity: "WATCH_AMBER",
  category,
  title,
  customerExplanation: explanation,
  measurement,
  low,
  high,
  horizonText,
});

export const SUPPORT_HOUSEHOLDS: SupportHousehold[] = [
  {
    key: "household:nguyen",
    name: "Nguyen household",
    firstName: "Linh",
    lastName: "Nguyen",
    mobile: "0491 570 120",
    vehicle: sv("vehicle:nguyen-corolla", "1HKQ 556", "Toyota", "Corolla", "Ascent Sport hatch", 2018, "JTNK4RBE80J012345", "Silver Pearl", "Hatchback", 112_400, 38),
    inspectionDaysAgo: 64,
    findings: [amber("finding:nguyen-tyres", "TYRES", "Front tyres at 3 mm", "Front tyres are getting low. Replace them within the next few thousand kilometres.", "3.0 mm tread", 46000, 56000, "Within ~4,000 km")],
  },
  {
    key: "household:obrien",
    name: "O'Brien household",
    firstName: "Shane",
    lastName: "O'Brien",
    mobile: "0491 570 121",
    vehicle: sv("vehicle:obrien-dmax", "1DMX 774", "Isuzu", "D-Max", "SX 4x2 single cab", 2017, "MPATFS86JHT012345", "Splash White", "Cab chassis ute", 188_900, 96),
    inspectionDaysAgo: 118,
    findings: [amber("finding:obrien-clutch", "TRANSMISSION", "Clutch slipping under load", "The clutch slips when loaded up a hill. It'll get worse with towing; plan a replacement.", "Slips at 2,800 rpm in 4th", 160000, 195000, "Within 2–3 months")],
  },
  {
    key: "household:papadopoulos",
    name: "Papadopoulos household",
    firstName: "Eleni",
    lastName: "Papadopoulos",
    mobile: "0491 570 122",
    vehicle: sv("vehicle:papa-i30", "1IHP 330", "Hyundai", "i30", "Active hatch", 2020, "KMHH351EMLU012345", "Fluid Metal", "Hatchback", 58_300, 30),
    inspectionDaysAgo: 21,
    findings: [amber("finding:papa-rear-pads", "BRAKES", "Rear brake pads at 4 mm", "Rear pads are wearing down. Fine for now; replace at or before the next service.", "4 mm left", 28000, 34000, "At your next service")],
  },
  {
    key: "household:walker",
    name: "Walker household",
    firstName: "Craig",
    lastName: "Walker",
    mobile: "0491 570 123",
    vehicle: sv("vehicle:walker-navara", "1NVR 615", "Nissan", "Navara", "NP300 ST 4x4", 2015, "MNTCB4D23A0012345", "Slate Grey", "Dual cab ute", 201_700, 70),
    inspectionDaysAgo: 9,
    findings: [
      {
        key: "finding:walker-lca",
        severity: "URGENT_RED",
        category: "SUSPENSION",
        title: "Front lower control arm bushes split",
        customerExplanation: "Both front lower control arm bushes have split. The wheels can shift under braking, which affects steering. This needs fixing before regular driving.",
        measurement: "Both sides, visible separation",
        diagram: "SHOCK",
        low: 52000,
        high: 64000,
        safetyCritical: true,
        status: "DECLINED",
      },
    ],
  },
  {
    key: "household:singh",
    name: "Singh household",
    firstName: "Harpreet",
    lastName: "Singh",
    mobile: "0491 570 124",
    vehicle: sv("vehicle:singh-sportage", "1KSG 902", "Kia", "Sportage", "SX AWD", 2019, "KNAPU81GMK7012345", "Clear White", "SUV", 96_200, 41),
    inspectionDaysAgo: 45,
    findings: [amber("finding:singh-rocker", "ENGINE", "Rocker cover gasket weeping", "There's a light oil weep from the rocker cover gasket. Not urgent, but it can drip onto the exhaust over time.", "Light weep, rear of head", 38000, 46000, "Within 3 months")],
  },
  {
    key: "household:thompson",
    name: "Thompson household",
    firstName: "Gail",
    lastName: "Thompson",
    mobile: "0491 570 125",
    vehicle: sv("vehicle:thompson-prado", "1PRD 448", "Toyota", "Prado", "GXL", 2014, "JTEBR3FJ20K012345", "Graphite", "SUV", 238_600, 52),
    inspectionDaysAgo: 152,
    findings: [
      amber("finding:thompson-diff-seal", "DRIVELINE", "Front diff pinion seal leaking", "The front diff seal is leaking oil. Topped up for now; replace before it runs low.", "Wet around pinion", 42000, 52000, "Within 2 months"),
      amber("finding:thompson-trans", "TRANSMISSION", "Transmission service overdue", "Transmission fluid is due for replacement for its age and kilometres.", "Last done 160,000 km", 39000, 45000, "At your next service"),
    ],
  },
  {
    key: "household:murphy",
    name: "Murphy household",
    firstName: "Aoife",
    lastName: "Murphy",
    mobile: "0491 570 126",
    vehicle: sv("vehicle:murphy-zs", "1MGZ 117", "MG", "ZS", "Excite", 2021, "LSJA24U95MZ012345", "Dover White", "SUV", 41_900, 28),
    inspectionDaysAgo: 33,
    findings: [amber("finding:murphy-battery", "BATTERY", "Battery at 61%", "The battery is losing capacity. Replace it before winter to avoid a no-start.", "61% health", 21900, 26900, "Before winter")],
  },
  {
    key: "household:fraser",
    name: "Fraser household",
    firstName: "Rob",
    lastName: "Fraser",
    mobile: "0491 570 127",
    vehicle: sv("vehicle:fraser-forester", "1SFR 286", "Subaru", "Forester", "2.5i-L", 2016, "JF1SJ9KL5GG012345", "Jasmine Green", "SUV", 133_400, 44),
    inspectionDaysAgo: 77,
    findings: [amber("finding:fraser-cv", "DRIVELINE", "Front left CV boot torn", "The CV boot is torn and losing grease. Replacing the boot now saves replacing the whole joint later.", "Split, grease thrown", 29000, 36000, "Within 1 month")],
  },
  {
    key: "household:kelly",
    name: "Kelly household",
    firstName: "Brendan",
    lastName: "Kelly",
    mobile: "0491 570 128",
    vehicle: sv("vehicle:kelly-triton", "1MTR 553", "Mitsubishi", "Triton", "GLX 4x4", 2012, "MMAJNKB40CD012345", "White", "Dual cab ute", 264_100, 85),
    inspectionDaysAgo: 14,
    findings: [
      {
        key: "finding:kelly-shoes",
        severity: "URGENT_RED",
        category: "BRAKES",
        title: "Rear brake shoes contaminated with diff oil",
        customerExplanation: "Oil from a leaking axle seal has soaked the rear brake shoes, so the rear brakes barely work. This needs fixing before regular driving.",
        measurement: "Both sides oil-soaked",
        diagram: "BRAKE_PAD",
        low: 34000,
        high: 42000,
        safetyCritical: true,
        status: "OPEN",
      },
    ],
  },
  {
    key: "household:rossi",
    name: "Rossi household",
    firstName: "Marco",
    lastName: "Rossi",
    mobile: "0491 570 129",
    vehicle: sv("vehicle:rossi-everest", "1EVR 031", "Ford", "Everest", "Trend 4WD", 2022, "MNAUMFF80NW012345", "Meteor Grey", "SUV", 39_800, 47),
    inspectionDaysAgo: 5,
    findings: [amber("finding:rossi-align", "TYRES", "Wheel alignment out", "Steering pulls slightly left and the front tyres are wearing on the inside edge. An alignment will fix it.", "Toe-out 0.4° front left", 12900, 15900, "Within 1 month")],
  },
];

/** A historic AAAA refusal (Walker household) so the Compliance Vault isn't empty on day one. */
export const WALKER_REFUSAL = {
  findingKey: "finding:walker-lca",
  vehicleKey: "vehicle:walker-navara",
  signerName: "Craig Walker",
  daysAgo: 9,
  acknowledgements: {
    unsafeToDrive: true,
    mechanicalReason: true,
    mechanicalDangers: true,
    safetyDangers: true,
    repairOrTowRecommended: true,
  } satisfies RefusalAcknowledgements,
  reason: "Will get it done at a mate's place this weekend.",
};

/** Booking + mod request waiting in the triage inbox. */
export const TRIAGE_SEEDS = {
  booking: {
    key: "booking:papa-pads",
    vehicleKey: "vehicle:papa-i30",
    findingKeys: ["finding:papa-rear-pads"],
    serviceType: "LOGBOOK_AND_REPAIR",
    inDays: 5,
    dropOff: "7:30 – 8:30 am",
    loanCar: true,
    notes: "Can you also check the aircon? Smells musty.",
    hoursAgo: 20,
  },
  mod: {
    key: "mod:obrien-bullbar",
    vehicleKey: "vehicle:obrien-dmax",
    modType: "BULLBAR_LIGHTS",
    title: "Steel bullbar + LED driving lights",
    description: "Doing a lot of early-morning runs out past Collie. Want a steel bar with a winch mount and a pair of LED driving lights wired properly.",
    usage: "Work ute, rural roads at dawn/dusk",
    budgetBand: "A$2,000 – A$3,500",
    hoursAgo: 30,
  },
};

/** Deterministic signature-like SVG path for seeded sign-offs. */
export function seededSignature(name: string): string {
  let x = 10;
  const pts: string[] = ["M 10 40"];
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    x += 8 + (c % 5);
    const y = 40 + Math.round(Math.sin(c + i) * 16);
    pts.push(`L ${x} ${y}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 20} 80"><path d="${pts.join(" ")}" fill="none" stroke="#1F2428" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function isoInDays(today: string, days: number) {
  return addDaysIso(today, days);
}
