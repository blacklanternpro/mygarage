/** Deterministic, stateful Stage 1 mocks for NEVDIS, SMS, Wallet, STT, Media and Payments. */
import { eq } from "drizzle-orm";
import { mediaAssets } from "@/db/schema";
import { canonicalJson, sha256, shortHash } from "@/domain/ids";
import type {
  MediaStorageAdapter,
  NevdisAdapter,
  NevdisVehicle,
  PaymentAdapter,
  PaymentIntent,
  Rail,
  ServiceStickerPass,
  SmsAdapter,
  SmsResult,
  StoredObject,
  SttResult,
  VoiceSttAdapter,
  WalletIssueResult,
  WalletPassAdapter,
  WalletPushResult,
} from "../contracts";
import { logEvent, nextSeq, type MockContext } from "./events";
import { lookupFixture } from "./fixtures/nevdis-registry";
import { STT_CLIPS } from "./fixtures/stt-clips";

// ─── NEVDIS ────────────────────────────────────────────────────────────────

export class MockNevdisAdapter implements NevdisAdapter {
  readonly info = {
    port: "nevdis",
    contract: "NevdisAdapter",
    mode: "MOCK",
    provider: "Fixture register",
    liveProvider: "BlueFlag / InfoAgent (authorised NEVDIS broker)",
    stage: "Stage 2",
    envVar: "ADAPTER_NEVDIS",
  } as const;
  constructor(private ctx: MockContext) {}
  async lookupByRego(input: { state: string; rego: string }): Promise<NevdisVehicle | null> {
    const seq = await nextSeq(this.ctx, "nevdis");
    const hit = lookupFixture(input.state, input.rego);
    await logEvent(this.ctx, {
      port: "nevdis",
      operation: "lookupByRego",
      seq,
      request: input,
      response: hit ? { found: true, vin: hit.vin, make: hit.make, model: hit.model, illustrativeCostCents: 30 } : { found: false },
    });
    return hit;
  }
}

// ─── SMS ───────────────────────────────────────────────────────────────────

export function smsSegments(body: string): number {
  return body.length <= 160 ? 1 : Math.ceil(body.length / 153);
}

export class MockSmsAdapter implements SmsAdapter {
  readonly info = {
    port: "sms",
    contract: "SmsAdapter",
    mode: "MOCK",
    provider: "Outbox log (3.0c/segment modelled)",
    liveProvider: "Texto or DataFlows / Mobile Message (ACMA Sender ID)",
    stage: "Stage 2",
    envVar: "ADAPTER_SMS",
  } as const;
  constructor(private ctx: MockContext) {}
  async send(input: { to: string; body: string; senderId: string; tag?: string }): Promise<SmsResult> {
    const seq = await nextSeq(this.ctx, "sms");
    const segments = smsSegments(input.body);
    const result: SmsResult = {
      messageId: `sms_${shortHash(`${seq}|${input.to}|${input.body}`, 12)}`,
      status: "DELIVERED",
      segments,
      costCents: 3 * segments,
      provider: "Texto (mock)",
    };
    await logEvent(this.ctx, { port: "sms", operation: "send", seq, request: { ...input }, response: { ...result } });
    return result;
  }
}

// ─── Wallet ────────────────────────────────────────────────────────────────

const PASS_TYPE_ID = "pass.au.mygarage.service-sticker";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

export class MockWalletPassAdapter implements WalletPassAdapter {
  readonly info = {
    port: "wallet",
    contract: "WalletPassAdapter",
    mode: "MOCK",
    provider: "Unsigned pass.json + Google generic object",
    liveProvider: "In-house Apple PassKit signing + Google Wallet API",
    stage: "Stage 2",
    envVar: "ADAPTER_WALLET",
  } as const;
  constructor(private ctx: MockContext) {}

  async issue(pass: ServiceStickerPass): Promise<WalletIssueResult> {
    const seq = await nextSeq(this.ctx, "wallet");
    const applePassJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      serialNumber: pass.serialNumber,
      teamIdentifier: "MOCKTEAM01",
      organizationName: pass.organizationName,
      description: pass.description,
      logoText: pass.logoText,
      backgroundColor: hexToRgb(pass.brandColour),
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(214, 226, 232)",
      generic: { primaryFields: pass.primary, secondaryFields: pass.secondary, auxiliaryFields: pass.auxiliary, backFields: pass.back },
      barcodes: [{ format: "PKBarcodeFormatQR", message: pass.barcodeMessage, messageEncoding: "iso-8859-1" }],
      webServiceURL: "https://api.mygarage.example/wallet/",
      authenticationToken: shortHash(`auth|${pass.serialNumber}`, 32),
      ...(pass.relevantDate ? { relevantDate: pass.relevantDate } : {}),
    };
    const googleObject = {
      id: `MOCKISSUER.${pass.serialNumber}`,
      classId: "MOCKISSUER.service_sticker",
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      hexBackgroundColor: pass.brandColour,
      cardTitle: { defaultValue: { language: "en-AU", value: pass.organizationName } },
      header: { defaultValue: { language: "en-AU", value: pass.primary[0]?.value ?? "" } },
      textModulesData: [...pass.secondary, ...pass.auxiliary].map((f) => ({ id: f.key, header: f.label, body: f.value })),
      barcode: { type: "QR_CODE", value: pass.barcodeMessage },
    };
    const signature = `mock-sha256:${sha256(canonicalJson(applePassJson))}`;
    const result: WalletIssueResult = {
      serialNumber: pass.serialNumber,
      applePassJson,
      googleObject,
      signature,
      addToAppleUrl: `/api/wallet/${encodeURIComponent(pass.serialNumber)}?format=apple`,
      addToGoogleUrl: `/api/wallet/${encodeURIComponent(pass.serialNumber)}?format=google`,
    };
    await logEvent(this.ctx, { port: "wallet", operation: "issue", seq, request: { serialNumber: pass.serialNumber }, response: { signature } });
    return result;
  }

  async pushUpdate(input: { serialNumber: string; message: string }): Promise<WalletPushResult> {
    const seq = await nextSeq(this.ctx, "wallet");
    const result: WalletPushResult = { delivered: 2, channel: "BOTH", pushId: `push_${shortHash(`${seq}|${input.serialNumber}|${input.message}`, 12)}` };
    await logEvent(this.ctx, { port: "wallet", operation: "pushUpdate", seq, request: input, response: { ...result } });
    return result;
  }
}

// ─── Speech-to-text ────────────────────────────────────────────────────────

export class MockVoiceSttAdapter implements VoiceSttAdapter {
  readonly info = {
    port: "stt",
    contract: "VoiceSttAdapter",
    mode: "MOCK",
    provider: "Pre-recorded bay clips (Nova-3 format)",
    liveProvider: "Deepgram Nova-3 (or OpenAI gpt-transcribe). Never whisper-1.",
    stage: "Stage 3",
    envVar: "ADAPTER_STT",
  } as const;
  constructor(private ctx: MockContext) {}
  clips() {
    return STT_CLIPS.map(({ id, label, durationSec }) => ({ id, label, durationSec }));
  }
  async transcribe(input: { clipId?: string; audioBase64?: string; mimeType?: string }): Promise<SttResult> {
    const seq = await nextSeq(this.ctx, "stt");
    const clip =
      STT_CLIPS.find((c) => c.id === input.clipId) ??
      STT_CLIPS[(input.audioBase64?.length ?? seq) % STT_CLIPS.length];
    const result: SttResult = {
      transcript: clip.transcript,
      confidence: clip.confidence,
      durationSec: clip.durationSec,
      model: "deepgram-nova-3",
      words: clip.transcript.split(/\s+/).length,
    };
    await logEvent(this.ctx, {
      port: "stt",
      operation: "transcribe",
      seq,
      request: { clipId: clip.id, audioBytes: input.audioBase64 ? Math.round((input.audioBase64.length * 3) / 4) : 0 },
      response: { model: result.model, words: result.words, confidence: result.confidence, costUsdModelled: +(clip.durationSec / 60 * 0.0043).toFixed(5) },
    });
    return result;
  }
}

// ─── Media storage ─────────────────────────────────────────────────────────

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "audio/webm": "webm" };

export class MockMediaStorageAdapter implements MediaStorageAdapter {
  readonly info = {
    port: "media",
    contract: "MediaStorageAdapter",
    mode: "MOCK",
    provider: "Postgres blob table",
    liveProvider: "Cloudflare R2 (S3 API, zero egress)",
    stage: "Stage 2",
    envVar: "ADAPTER_MEDIA",
  } as const;
  constructor(private ctx: MockContext) {}
  async put(input: { workshopId: string; kind: "PHOTO" | "PDF" | "AUDIO" | "VIDEO"; contentType: string; bytes: Uint8Array; vehicleId?: string }): Promise<StoredObject> {
    const seq = await nextSeq(this.ctx, "media");
    const digest = sha256(Buffer.from(input.bytes).toString("base64")).slice(0, 20);
    const key = `r2://mygarage-syd/${input.workshopId}/${input.kind.toLowerCase()}/${digest}.${EXT[input.contentType] ?? "bin"}`;
    await this.ctx.db
      .insert(mediaAssets)
      .values({
        workshopId: input.workshopId,
        key,
        kind: input.kind,
        contentType: input.contentType,
        bytes: input.bytes.byteLength,
        dataBase64: Buffer.from(input.bytes).toString("base64"),
        vehicleId: input.vehicleId,
      })
      .onConflictDoNothing({ target: mediaAssets.key });
    const obj: StoredObject = { key, url: `/api/media?key=${encodeURIComponent(key)}`, bytes: input.bytes.byteLength, contentType: input.contentType };
    await logEvent(this.ctx, { port: "media", operation: "put", seq, request: { kind: input.kind, contentType: input.contentType, bytes: input.bytes.byteLength }, response: { key } });
    return obj;
  }
  async get(key: string) {
    const [row] = await this.ctx.db.select().from(mediaAssets).where(eq(mediaAssets.key, key)).limit(1);
    if (!row?.dataBase64) return null;
    return { bytes: new Uint8Array(Buffer.from(row.dataBase64, "base64")), contentType: row.contentType };
  }
}

// ─── Payments ──────────────────────────────────────────────────────────────

const INSTRUCTIONS: Record<Rail, string> = {
  PAYTO: "PayTo agreement authorised in your banking app. Funds settle instantly via the NPP.",
  CARD: "Card payment approved. No surcharge applied.",
  APPLE_PAY: "Apple Pay payment approved. No surcharge applied.",
  GOOGLE_PAY: "Google Pay payment approved. No surcharge applied.",
  BNPL_AFTERPAY: "Afterpay plan approved: 4 fortnightly instalments, no surcharge.",
  BNPL_ZIP: "Zip plan approved. No surcharge.",
};

export class MockPaymentAdapter implements PaymentAdapter {
  readonly info = {
    port: "payment",
    contract: "PaymentAdapter",
    mode: "MOCK",
    provider: "Simulated Stripe AU intents",
    liveProvider: "Stripe Australia (PayTo, card, Apple/Google Pay, Afterpay/Zip)",
    stage: "Stage 3",
    envVar: "ADAPTER_PAYMENT",
  } as const;
  constructor(private ctx: MockContext) {}
  async createIntent(input: { amountCents: number; rail: Rail; reference: string; workshopFeeCents: number }): Promise<PaymentIntent> {
    const seq = await nextSeq(this.ctx, "payment");
    const intent: PaymentIntent = {
      id: `pi_mock_${shortHash(`${seq}|${input.reference}|${input.rail}|${input.amountCents}`, 14)}`,
      rail: input.rail,
      amountCents: input.amountCents,
      workshopFeeCents: input.workshopFeeCents,
      surchargeCents: 0,
      status: "SUCCEEDED",
      instructions: INSTRUCTIONS[input.rail],
    };
    await logEvent(this.ctx, { port: "payment", operation: "createIntent", seq, request: { ...input }, response: { ...intent } });
    return intent;
  }
}
