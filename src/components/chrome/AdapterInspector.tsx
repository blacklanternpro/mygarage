"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface AdapterRow {
  port: string;
  contract: string;
  mode: "MOCK" | "LIVE";
  provider: string;
  liveProvider: string;
  stage: string;
  envVar: string;
}
interface EventRow {
  id: string;
  port: string;
  operation: string;
  seq: number;
  createdAt: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

function summarise(e: EventRow): string {
  const r = e.request;
  if (e.port === "sms") return `→ ${r.to}: ${String(r.body ?? "").slice(0, 90)}${String(r.body ?? "").length > 90 ? "…" : ""}`;
  if (e.port === "wallet") return e.operation === "pushUpdate" ? `Push "${String(r.message ?? "")}"` : `Issued ${String(r.serialNumber ?? "")}`;
  if (e.port === "ingestion") return `${String(r.filename ?? "")} → confidence ${String(e.response.confidence ?? "")}`;
  if (e.port === "nevdis") return `${String(r.state)} ${String(r.rego)} → ${e.response.found ? `${e.response.make} ${e.response.model}` : "not found"}`;
  if (e.port === "stt") return `${String(r.clipId)} → ${String(e.response.words)} words (${String(e.response.model)})`;
  if (e.port === "payment") return `${String(r.rail)} A$${((Number(r.amountCents) || 0) / 100).toFixed(2)} → fee A$${((Number(r.workshopFeeCents) || 0) / 100).toFixed(2)}, surcharge A$0.00`;
  if (e.port === "media") return `${String(r.kind)} ${String(r.contentType)} ${String(r.bytes)} bytes`;
  return e.operation;
}

export function AdapterInspector({ onMagicLink, onClose }: { onMagicLink: () => void; onClose: () => void }) {
  const [data, setData] = useState<{ adapters: AdapterRow[]; events: EventRow[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/adapters")
        .then((r) => r.json())
        .then((j) => live && setData(j))
        .catch(() => live && setError(true));
    load();
    const t = setInterval(load, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return (
    <div className="border-t border-white/10 bg-[#171b1e]">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-3 py-3 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="ports-h">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="ports-h" className="text-[13px] font-bold text-white">
              Hexagonal ports
            </h2>
            <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded text-white/60 hover:bg-white/10 lg:hidden" aria-label="Close inspector">
              <Icon name="close" size={16} />
            </button>
          </div>
          {error ? <p className="text-[13px] text-white/70">Couldn’t load adapter status.</p> : null}
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {(data?.adapters ?? []).map((a) => (
              <li key={a.port} className="rounded border border-white/10 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={`readout rounded-sm px-1 text-[10px] font-bold ${a.mode === "MOCK" ? "bg-rag-amber text-sump" : "bg-rag-green text-white"}`}>{a.mode}</span>
                  <span className="readout text-[12px] text-white">{a.contract}</span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-white/70">{a.provider}</p>
                <p className="text-[12px] leading-snug text-white/45">
                  {a.stage}: {a.liveProvider} · <span className="readout">{a.envVar}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="calls-h">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="calls-h" className="text-[13px] font-bold text-white">
              Recent mock calls
            </h2>
            <button type="button" onClick={onMagicLink} className="inline-flex h-8 items-center gap-1.5 rounded border border-white/20 px-2 text-[12px] font-semibold text-white hover:bg-white/10">
              <Icon name="link" size={14} /> Preview SMS magic-link flow
            </button>
          </div>
          <ol className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {data && !data.events.length ? <li className="text-[13px] text-white/60">No calls yet. Approve a quote, publish an invoice or dictate a finding and they’ll appear here.</li> : null}
            {(data?.events ?? []).map((e) => (
              <li key={e.id} className="flex gap-2 text-[12px] leading-snug text-white/80">
                <span className="readout w-16 shrink-0 text-white/45">{new Date(e.createdAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                <span className="readout w-16 shrink-0 text-rag-amber">{e.port}</span>
                <span className="min-w-0 break-words">{summarise(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
