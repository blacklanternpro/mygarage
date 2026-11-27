/**
 * Stage 2/3 live adapter seams. Each stub satisfies its contract and fails loudly until the
 * provider is implemented and credentials are configured. Replace one file at a time.
 */
import { AdapterNotConfiguredError, type Adapters, type AdapterInfo, type PortName } from "../contracts";

function info(port: PortName, contract: string, liveProvider: string, stage: AdapterInfo["stage"]): AdapterInfo {
  return { port, contract, mode: "LIVE", provider: liveProvider, liveProvider, stage, envVar: `ADAPTER_${port.toUpperCase()}` };
}
const fail = (port: PortName, provider: string) => async (): Promise<never> => {
  throw new AdapterNotConfiguredError(port, provider);
};

export function liveAdapters(): Adapters {
  return {
    ingestion: { info: info("ingestion", "IngestionAdapter", "AWS Textract / Azure Read → Gemini Flash-Lite", "Stage 2"), extractInvoice: fail("ingestion", "Gemini Flash-Lite") },
    nevdis: { info: info("nevdis", "NevdisAdapter", "BlueFlag / InfoAgent", "Stage 2"), lookupByRego: fail("nevdis", "BlueFlag") },
    sms: { info: info("sms", "SmsAdapter", "Texto / DataFlows", "Stage 2"), send: fail("sms", "Texto") },
    wallet: {
      info: info("wallet", "WalletPassAdapter", "Apple PassKit + Google Wallet", "Stage 2"),
      issue: fail("wallet", "PassKit"),
      pushUpdate: fail("wallet", "APNs"),
    },
    stt: {
      info: info("stt", "VoiceSttAdapter", "Deepgram Nova-3", "Stage 3"),
      transcribe: fail("stt", "Deepgram Nova-3"),
      clips: () => [],
    },
    media: { info: info("media", "MediaStorageAdapter", "Cloudflare R2", "Stage 2"), put: fail("media", "Cloudflare R2"), get: fail("media", "Cloudflare R2") },
    payment: { info: info("payment", "PaymentAdapter", "Stripe Australia", "Stage 3"), createIntent: fail("payment", "Stripe") },
  };
}
