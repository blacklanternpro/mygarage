/**
 * Hexagonal ports. UI and domain code depend ONLY on these interfaces.
 * Stage 1: deterministic, stateful mocks (src/adapters/mocks). Stage 2/3: live providers
 * (src/adapters/live) implementing the same contracts. Selection: src/adapters/registry.ts.
 */
import type { LineItem } from "@/db/schema";

export type AdapterMode = "MOCK" | "LIVE";

export type PortName = "ingestion" | "nevdis" | "sms" | "wallet" | "stt" | "media" | "payment";

export interface AdapterInfo {
  port: PortName;
  contract: string;
  mode: AdapterMode;
  provider: string;
  /** Provider planned for the live implementation. */
  liveProvider: string;
  stage: "Stage 2" | "Stage 3";
  envVar: string;
}

interface Port {
  readonly info: AdapterInfo;
}

// ─── Ingestion (OCR + LLM structuring) ─────────────────────────────────────

export interface IngestionStep {
  key: "ocr" | "layout" | "llm" | "validate";
  label: string;
  ms: number;
  detail: string;
}

export interface ExtractedRecommendation {
  severity: "URGENT_RED" | "WATCH_AMBER";
  title: string;
  detail: string;
  estimateLowCents: number | null;
  estimateHighCents: number | null;
  horizonText: string | null;
  category: string;
}

export interface ExtractedInvoice {
  wms: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // ISO YYYY-MM-DD
  rego: string | null;
  regoState: string | null;
  vin: string | null;
  vehicleDescription: string | null;
  odometerKm: number | null;
  customerName: string | null;
  customerMobile: string | null;
  technicianName: string | null;
  lineItems: LineItem[];
  subtotalCents: number | null;
  gstCents: number | null;
  totalCents: number | null;
  paymentNote: string | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  recommendations: ExtractedRecommendation[];
  checkedOk: string[];
  summary: string | null;
}

export interface IngestionResult {
  text: string;
  pageCount: number;
  extracted: ExtractedInvoice;
  /** 0–1 overall confidence; per-field flags for the review gate. */
  confidence: number;
  fieldConfidence: Record<string, number>;
  warnings: string[];
  steps: IngestionStep[];
  model: string;
}

export interface IngestionAdapter extends Port {
  extractInvoice(input: { filename: string; bytes: Uint8Array }): Promise<IngestionResult>;
}

// ─── NEVDIS (national vehicle register via authorised broker) ─────────────

export interface NevdisVehicle {
  rego: string;
  state: string;
  vin: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  colour: string;
  bodyType: string;
  engine: string;
  regoExpiry: string; // ISO
  stolen: boolean;
  writtenOff: boolean;
}

export interface NevdisAdapter extends Port {
  lookupByRego(input: { state: string; rego: string }): Promise<NevdisVehicle | null>;
}

// ─── SMS ───────────────────────────────────────────────────────────────────

export interface SmsResult {
  messageId: string;
  status: "QUEUED" | "DELIVERED" | "FAILED";
  segments: number;
  costCents: number;
  provider: string;
}

export interface SmsAdapter extends Port {
  send(input: { to: string; body: string; senderId: string; tag?: string }): Promise<SmsResult>;
}

// ─── Wallet passes ─────────────────────────────────────────────────────────

export interface PassField {
  key: string;
  label: string;
  value: string;
}

export interface ServiceStickerPass {
  serialNumber: string;
  organizationName: string;
  description: string;
  logoText: string;
  brandColour: string;
  primary: PassField[];
  secondary: PassField[];
  auxiliary: PassField[];
  back: PassField[];
  barcodeMessage: string;
  relevantDate?: string;
}

export interface WalletIssueResult {
  serialNumber: string;
  applePassJson: Record<string, unknown>;
  googleObject: Record<string, unknown>;
  signature: string;
  addToAppleUrl: string;
  addToGoogleUrl: string;
}

export interface WalletPushResult {
  delivered: number;
  channel: "APNS" | "GOOGLE_WALLET" | "BOTH";
  pushId: string;
}

export interface WalletPassAdapter extends Port {
  issue(pass: ServiceStickerPass): Promise<WalletIssueResult>;
  pushUpdate(input: { serialNumber: string; message: string }): Promise<WalletPushResult>;
}

// ─── Speech-to-text ────────────────────────────────────────────────────────

/** Approved models only; whisper-1 and gpt-4o-transcribe are deliberately absent. */
export type SttModel = "deepgram-nova-3" | "gpt-transcribe";

export interface SttResult {
  transcript: string;
  confidence: number;
  durationSec: number;
  model: SttModel;
  words: number;
}

export interface VoiceSttAdapter extends Port {
  transcribe(input: { clipId?: string; audioBase64?: string; mimeType?: string }): Promise<SttResult>;
  clips(): { id: string; label: string; durationSec: number }[];
}

// ─── Media storage ─────────────────────────────────────────────────────────

export interface StoredObject {
  key: string;
  url: string;
  bytes: number;
  contentType: string;
}

export interface MediaStorageAdapter extends Port {
  put(input: { workshopId: string; kind: "PHOTO" | "PDF" | "AUDIO" | "VIDEO"; contentType: string; bytes: Uint8Array; vehicleId?: string }): Promise<StoredObject>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

// ─── Payments ──────────────────────────────────────────────────────────────

export type Rail = "PAYTO" | "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "BNPL_AFTERPAY" | "BNPL_ZIP";

export interface PaymentIntent {
  id: string;
  rail: Rail;
  amountCents: number;
  workshopFeeCents: number;
  /** Always 0 — card surcharging is banned from 1 Oct 2026. */
  surchargeCents: 0;
  status: "SUCCEEDED" | "PENDING" | "REQUIRES_ACTION";
  instructions?: string;
}

export interface PaymentAdapter extends Port {
  createIntent(input: { amountCents: number; rail: Rail; reference: string; workshopFeeCents: number }): Promise<PaymentIntent>;
}

// ─── Bundle ────────────────────────────────────────────────────────────────

export interface Adapters {
  ingestion: IngestionAdapter;
  nevdis: NevdisAdapter;
  sms: SmsAdapter;
  wallet: WalletPassAdapter;
  stt: VoiceSttAdapter;
  media: MediaStorageAdapter;
  payment: PaymentAdapter;
}

export class AdapterNotConfiguredError extends Error {
  constructor(port: PortName, provider: string) {
    super(`The live ${port} adapter (${provider}) is not configured yet — set ADAPTER_${port.toUpperCase()}=mock or add Stage 2 credentials.`);
    this.name = "AdapterNotConfiguredError";
  }
}
