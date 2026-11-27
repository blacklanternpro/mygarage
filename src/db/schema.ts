/**
 * MyGarage multi-tenant schema (Drizzle, PostgreSQL dialect).
 *
 * Stage 1 runs on PGlite (embedded Postgres). Stage 2 points the same schema at AWS Sydney
 * (ap-southeast-2) Postgres with Row-Level Security keyed on `workshop_id` — every tenant table
 * below carries `workshop_id` + an index so the RLS policies in docs/sql/rls-policies.sql apply
 * without query changes.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const severityEnum = pgEnum("severity", ["URGENT_RED", "WATCH_AMBER", "HEALTHY_GREEN"]);

export const findingStatusEnum = pgEnum("finding_status", [
  "OPEN",
  "QUOTE_REQUESTED",
  "QUOTED",
  "APPROVED",
  "BOOKED",
  "PLANNED",
  "DECLINED",
  "RESOLVED_ELSEWHERE",
  "COMPLETED",
]);

export const reviewStatusEnum = pgEnum("review_status", ["PUBLISHED", "PENDING_REVIEW"]);

export const quoteStatusEnum = pgEnum("quote_status", ["ISSUED", "APPROVED", "DECLINED", "EXPIRED"]);

export const auditEventEnum = pgEnum("audit_event_type", [
  "QUOTE_ISSUED",
  "QUOTE_APPROVED",
  "QUOTE_DECLINED",
  "UNSAFE_VEHICLE_REFUSAL",
  "ESTIMATE_PLANNED",
  "RESOLVED_ELSEWHERE",
  "INVOICE_PUBLISHED",
  "FINDING_PUBLISHED",
]);

export const paymentRailEnum = pgEnum("payment_rail", [
  "PAYTO",
  "CARD",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "BNPL_AFTERPAY",
  "BNPL_ZIP",
]);

// ─── Shared JSON shapes ─────────────────────────────────────────────────────

export type LineItemKind = "PART" | "LABOUR" | "FEE";

export interface LineItem {
  id: string;
  kind: LineItemKind;
  description: string;
  /** Parts/fees: quantity. Labour: 1. */
  qty: number;
  /** Labour only: hours and hourly rate (ACL itemised-bill right). */
  hours?: number;
  rateCents?: number;
  /** Unit price inc. GST in cents (parts/fees). For labour = hours × rate. */
  unitCents: number;
  totalCents: number;
  partNumber?: string;
}

export interface RefusalAcknowledgements {
  unsafeToDrive: boolean;
  mechanicalReason: boolean;
  mechanicalDangers: boolean;
  safetyDangers: boolean;
  repairOrTowRecommended: boolean;
}

// ─── Column helpers ─────────────────────────────────────────────────────────

const pk = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => date(name, { mode: "string" });

// ─── Tenant root ────────────────────────────────────────────────────────────

export const workshops = pgTable(
  "workshops",
  {
    id: pk(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ownerNames: text("owner_names").notNull(),
    staffCount: integer("staff_count").notNull(),
    addressLine: text("address_line").notNull(),
    suburb: text("suburb").notNull(),
    state: text("state").notNull(),
    postcode: text("postcode").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    abn: text("abn").notNull(),
    /** State repairer licence (WA: MRB, NSW: MVRL). Displayed on every report/quote/pass. */
    licenceState: text("licence_state").notNull(),
    licenceType: text("licence_type").notNull(),
    licenceNumber: text("licence_number").notNull(),
    wms: text("wms").notNull(),
    brandPrimary: text("brand_primary").notNull(),
    brandAccent: text("brand_accent").notNull(),
    smsSenderId: text("sms_sender_id").notNull(),
    hoursText: text("hours_text").notNull(),
    labourRateCents: integer("labour_rate_cents").notNull(),
    bayCount: integer("bay_count").notNull().default(4),
    paytoEnabled: boolean("payto_enabled").notNull().default(true),
    cardEnabled: boolean("card_enabled").notNull().default(true),
    bnplEnabled: boolean("bnpl_enabled").notNull().default(false),
    bnplMinCents: integer("bnpl_min_cents").notNull().default(60000),
    autoPublishThreshold: real("auto_publish_threshold").notNull().default(0.98),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workshops_slug_uq").on(t.slug)],
);

const workshopRef = () =>
  uuid("workshop_id")
    .notNull()
    .references(() => workshops.id, { onDelete: "cascade" });

// ─── Households, customers, vehicles ───────────────────────────────────────

export const households = pgTable(
  "households",
  {
    id: pk(),
    workshopId: workshopRef(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("households_workshop_idx").on(t.workshopId)],
);

export const customers = pgTable(
  "customers",
  {
    id: pk(),
    workshopId: workshopRef(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    mobile: text("mobile").notNull(),
    email: text("email"),
    addressLine: text("address_line"),
    suburb: text("suburb"),
    postcode: text("postcode"),
    role: text("role").notNull().default("MEMBER"),
    smsOptIn: boolean("sms_opt_in").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("customers_workshop_idx").on(t.workshopId), index("customers_household_idx").on(t.householdId)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: pk(),
    workshopId: workshopRef(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    primaryDriverId: uuid("primary_driver_id").references(() => customers.id, { onDelete: "set null" }),
    rego: text("rego").notNull(),
    regoState: text("rego_state").notNull(),
    regoExpiry: day("rego_expiry").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    variant: text("variant").notNull(),
    year: integer("year").notNull(),
    vin: text("vin").notNull(),
    colour: text("colour").notNull(),
    bodyType: text("body_type").notNull(),
    engine: text("engine").notNull(),
    transmission: text("transmission").notNull(),
    odometerKm: integer("odometer_km").notNull(),
    odometerAt: ts("odometer_at").notNull(),
    avgKmPerDay: real("avg_km_per_day").notNull(),
    nextServiceDueDate: day("next_service_due_date"),
    nextServiceDueKm: integer("next_service_due_km"),
    nickname: text("nickname"),
    createdAt: createdAt(),
  },
  (t) => [
    index("vehicles_workshop_idx").on(t.workshopId),
    index("vehicles_household_idx").on(t.householdId),
    uniqueIndex("vehicles_rego_uq").on(t.workshopId, t.regoState, t.rego),
  ],
);

// ─── Service history & inspections ─────────────────────────────────────────

export const serviceRecords = pgTable(
  "service_records",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    source: text("source").notNull(), // MECHANICDESK_PDF | BAY_DVI | SEED
    serviceDate: day("service_date").notNull(),
    odometerKm: integer("odometer_km").notNull(),
    summary: text("summary").notNull(),
    lineItems: jsonb("line_items").$type<LineItem[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstCents: integer("gst_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    technicianName: text("technician_name").notNull(),
    advisorName: text("advisor_name"),
    verified: boolean("verified").notNull().default(true),
    publishedAt: ts("published_at"),
    publishedBy: text("published_by"),
    pdfPath: text("pdf_path"),
    /** PII-adjacent (card last 4, payer). Redacted from the Verified Sale Pack. */
    paymentNote: text("payment_note"),
    ingestionJobId: uuid("ingestion_job_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("service_records_workshop_idx").on(t.workshopId),
    index("service_records_vehicle_idx").on(t.vehicleId),
    uniqueIndex("service_records_invoice_uq").on(t.workshopId, t.invoiceNumber),
  ],
);

export const inspectionReports = pgTable(
  "inspection_reports",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    serviceRecordId: uuid("service_record_id").references(() => serviceRecords.id, { onDelete: "set null" }),
    inspectedAt: ts("inspected_at").notNull(),
    odometerKm: integer("odometer_km").notNull(),
    technicianName: text("technician_name").notNull(),
    summary: text("summary"),
    status: text("status").notNull().default("PUBLISHED"),
    createdAt: createdAt(),
  },
  (t) => [index("inspection_reports_workshop_idx").on(t.workshopId), index("inspection_reports_vehicle_idx").on(t.vehicleId)],
);

export const findings = pgTable(
  "findings",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    inspectionReportId: uuid("inspection_report_id").references(() => inspectionReports.id, { onDelete: "set null" }),
    severity: severityEnum("severity").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    customerExplanation: text("customer_explanation").notNull(),
    technicianNote: text("technician_note"),
    measurement: text("measurement"),
    diagram: text("diagram"), // BRAKE_PAD | SHOCK | BATTERY | TYRE | TIMING_BELT | FLUID | null
    horizonText: text("horizon_text"),
    horizonKm: integer("horizon_km"),
    horizonDate: day("horizon_date"),
    /** Non-binding indicative estimate range (inc. GST). Always shown with ACL_ESTIMATE_LABEL. */
    estimateLowCents: integer("estimate_low_cents"),
    estimateHighCents: integer("estimate_high_cents"),
    safetyCritical: boolean("safety_critical").notNull().default(false),
    status: findingStatusEnum("status").notNull().default("OPEN"),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("PUBLISHED"),
    plannedHorizon: text("planned_horizon"), // 1M | 3M | NEXT_SERVICE
    plannedRemindAt: ts("planned_remind_at"),
    resolvedNote: text("resolved_note"),
    source: text("source").notNull().default("TECH"), // TECH | VOICE_DVI | PDF_BRIDGE | SEED
    annotation: jsonb("annotation").$type<{ x: number; y: number; label: string }[]>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("findings_workshop_idx").on(t.workshopId),
    index("findings_vehicle_idx").on(t.vehicleId),
    check(
      "findings_estimate_range_ck",
      sql`${t.estimateLowCents} IS NULL OR ${t.estimateHighCents} IS NULL OR ${t.estimateLowCents} <= ${t.estimateHighCents}`,
    ),
  ],
);

// ─── Quotes, approvals & the compliance vault ─────────────────────────────

export const modQuoteRequests = pgTable(
  "mod_quote_requests",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    modType: text("mod_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    usage: text("usage"),
    budgetBand: text("budget_band"),
    vinSnapshot: text("vin_snapshot").notNull(),
    variantSnapshot: text("variant_snapshot").notNull(),
    photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
    productLink: text("product_link"),
    status: text("status").notNull().default("NEW"), // NEW | TRIAGED | QUOTED | CLOSED
    createdAt: createdAt(),
  },
  (t) => [index("mod_quote_requests_workshop_idx").on(t.workshopId), index("mod_quote_requests_vehicle_idx").on(t.vehicleId)],
);

export const fixedQuotes = pgTable(
  "fixed_quotes",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number").notNull(),
    title: text("title").notNull(),
    findingIds: jsonb("finding_ids").$type<string[]>().notNull().default([]),
    modQuoteRequestId: uuid("mod_quote_request_id").references(() => modQuoteRequests.id, { onDelete: "set null" }),
    lineItems: jsonb("line_items").$type<LineItem[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstCents: integer("gst_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    validUntil: day("valid_until").notNull(),
    status: quoteStatusEnum("status").notNull().default("ISSUED"),
    issuedBy: text("issued_by").notNull(),
    issuedAt: ts("issued_at").notNull(),
    decidedAt: ts("decided_at"),
    approvedLineIds: jsonb("approved_line_ids").$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("fixed_quotes_workshop_idx").on(t.workshopId),
    index("fixed_quotes_vehicle_idx").on(t.vehicleId),
    uniqueIndex("fixed_quotes_number_uq").on(t.workshopId, t.quoteNumber),
  ],
);

/**
 * Append-only compliance log (ACL approvals + AAAA unsafe vehicle refusals).
 * A plpgsql trigger (migration 0001) rejects UPDATE/DELETE. Each row's content_hash =
 * sha256(prev_hash + canonical JSON of the event), giving a per-workshop tamper-evident chain.
 */
export const quotesAndApprovals = pgTable(
  "quotes_and_approvals",
  {
    id: pk(),
    workshopId: workshopRef(),
    seq: integer("seq").notNull(),
    eventType: auditEventEnum("event_type").notNull(),
    vehicleId: uuid("vehicle_id"),
    findingId: uuid("finding_id"),
    quoteId: uuid("quote_id"),
    actorRole: text("actor_role").notNull(), // CUSTOMER | ADVISOR | TECH | SYSTEM
    signerName: text("signer_name"),
    signatureSvg: text("signature_svg"),
    acknowledgements: jsonb("acknowledgements").$type<RefusalAcknowledgements>(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    prevHash: text("prev_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    occurredAt: ts("occurred_at").notNull(),
  },
  (t) => [
    index("quotes_and_approvals_workshop_idx").on(t.workshopId),
    uniqueIndex("quotes_and_approvals_seq_uq").on(t.workshopId, t.seq),
  ],
);

// ─── Bookings, messages, reminders ─────────────────────────────────────────

export const bookings = pgTable(
  "bookings",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    serviceType: text("service_type").notNull(), // LOGBOOK | REPAIR | LOGBOOK_AND_REPAIR
    findingIds: jsonb("finding_ids").$type<string[]>().notNull().default([]),
    requestedDate: day("requested_date").notNull(),
    dropOff: text("drop_off").notNull(),
    loanCar: boolean("loan_car").notNull().default(false),
    notes: text("notes"),
    status: text("status").notNull().default("REQUESTED"), // REQUESTED | CONFIRMED | DECLINED
    createdAt: createdAt(),
  },
  (t) => [index("bookings_workshop_idx").on(t.workshopId), index("bookings_vehicle_idx").on(t.vehicleId)],
);

export const messages = pgTable(
  "messages",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    thread: text("thread").notNull().default("VEHICLE"), // VEHICLE | MOD
    modQuoteRequestId: uuid("mod_quote_request_id").references(() => modQuoteRequests.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => fixedQuotes.id, { onDelete: "set null" }),
    authorRole: text("author_role").notNull(), // CUSTOMER | ADVISOR | TECH | SYSTEM
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    channel: text("channel").notNull().default("APP"), // APP | SMS
    createdAt: createdAt(),
  },
  (t) => [index("messages_workshop_idx").on(t.workshopId), index("messages_vehicle_idx").on(t.vehicleId)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    findingId: uuid("finding_id").references(() => findings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // SERVICE_DUE | SERVICE_KM | REGO_EXPIRY | WATCH_ITEM | CAMPAIGN
    channel: text("channel").notNull(), // WALLET_PUSH | SMS
    scheduledFor: ts("scheduled_for").notNull(),
    status: text("status").notNull().default("SCHEDULED"), // SCHEDULED | SENT | CANCELLED
    message: text("message").notNull(),
    campaignKey: text("campaign_key"),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_workshop_idx").on(t.workshopId), index("reminders_vehicle_idx").on(t.vehicleId)],
);

// ─── Wallet, payments, ingestion, media, NEVDIS cache, adapter log ─────────

export const walletPasses = pgTable(
  "wallet_passes",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    serialNumber: text("serial_number").notNull(),
    passTypeIdentifier: text("pass_type_identifier").notNull(),
    version: integer("version").notNull().default(1),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    lastPushAt: ts("last_push_at"),
    lastPushMessage: text("last_push_message"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("wallet_passes_workshop_idx").on(t.workshopId), uniqueIndex("wallet_passes_vehicle_uq").on(t.vehicleId)],
);

export const payments = pgTable(
  "payments",
  {
    id: pk(),
    workshopId: workshopRef(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => fixedQuotes.id, { onDelete: "set null" }),
    rail: paymentRailEnum("rail").notNull(),
    amountCents: integer("amount_cents").notNull(),
    workshopFeeCents: integer("workshop_fee_cents").notNull(),
    /** Card surcharging is banned in Australia from 1 Oct 2026. Enforced at the DB level. */
    surchargeCents: integer("surcharge_cents").notNull().default(0),
    status: text("status").notNull(), // PENDING | AUTHORISED | SUCCEEDED | FAILED
    providerRef: text("provider_ref").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_workshop_idx").on(t.workshopId),
    check("payments_no_surcharge_ck", sql`${t.surchargeCents} = 0`),
    check("payments_amount_positive_ck", sql`${t.amountCents} > 0`),
  ],
);

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: pk(),
    workshopId: workshopRef(),
    filename: text("filename").notNull(),
    source: text("source").notNull(), // UPLOAD | SAMPLE | EMAIL_BCC
    status: text("status").notNull(), // IN_REVIEW | PUBLISHED | REJECTED | FAILED
    steps: jsonb("steps").$type<{ key: string; label: string; ms: number; detail: string }[]>().notNull(),
    extracted: jsonb("extracted").$type<Record<string, unknown>>().notNull(),
    confidence: real("confidence").notNull(),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    serviceRecordId: uuid("service_record_id"),
    mediaKey: text("media_key"),
    reviewSeconds: real("review_seconds"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
  },
  (t) => [index("ingestion_jobs_workshop_idx").on(t.workshopId)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: pk(),
    workshopId: workshopRef(),
    key: text("key").notNull(),
    kind: text("kind").notNull(), // PHOTO | PDF | AUDIO | VIDEO
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    /** Stage 1 only: bytes inline (base64). Stage 2: object lives in Cloudflare R2. */
    dataBase64: text("data_base64"),
    vehicleId: uuid("vehicle_id"),
    createdAt: createdAt(),
  },
  (t) => [index("media_assets_workshop_idx").on(t.workshopId), uniqueIndex("media_assets_key_uq").on(t.key)],
);

export const nevdisLookups = pgTable(
  "nevdis_lookups",
  {
    id: pk(),
    workshopId: workshopRef(),
    regoState: text("rego_state").notNull(),
    rego: text("rego").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    fetchedAt: ts("fetched_at").notNull(),
  },
  (t) => [index("nevdis_lookups_workshop_idx").on(t.workshopId), uniqueIndex("nevdis_lookups_uq").on(t.workshopId, t.regoState, t.rego)],
);

/** Mock adapter state + the Adapter Inspector feed. Stage 2 keeps it as an outbound-call audit. */
export const adapterEvents = pgTable(
  "adapter_events",
  {
    id: pk(),
    workshopId: uuid("workshop_id").references(() => workshops.id, { onDelete: "cascade" }),
    port: text("port").notNull(),
    operation: text("operation").notNull(),
    seq: integer("seq").notNull(),
    mode: text("mode").notNull(), // MOCK | LIVE
    request: jsonb("request").$type<Record<string, unknown>>().notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("adapter_events_workshop_idx").on(t.workshopId), index("adapter_events_port_idx").on(t.port, t.seq)],
);

export type Workshop = typeof workshops.$inferSelect;
export type Household = typeof households.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type InspectionReport = typeof inspectionReports.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type FixedQuote = typeof fixedQuotes.$inferSelect;
export type AuditEvent = typeof quotesAndApprovals.$inferSelect;
export type ModQuoteRequest = typeof modQuoteRequests.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type WalletPass = typeof walletPasses.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type AdapterEvent = typeof adapterEvents.$inferSelect;
export type Severity = (typeof severityEnum.enumValues)[number];
export type FindingStatus = (typeof findingStatusEnum.enumValues)[number];
export type PaymentRail = (typeof paymentRailEnum.enumValues)[number];
export type AuditEventType = (typeof auditEventEnum.enumValues)[number];

/** Every tenant table, in truncate order (used by demo reset). */
export const TENANT_TABLE_NAMES = [
  "adapter_events",
  "nevdis_lookups",
  "media_assets",
  "ingestion_jobs",
  "payments",
  "wallet_passes",
  "reminders",
  "messages",
  "bookings",
  "quotes_and_approvals",
  "fixed_quotes",
  "mod_quote_requests",
  "findings",
  "inspection_reports",
  "service_records",
  "vehicles",
  "customers",
  "households",
  "workshops",
] as const;
