"use client";
import { useState } from "react";
import type { ServiceStickerPass } from "@/adapters/contracts";
import { Icon } from "@/components/ui/Icon";

function Field({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/65">{label}</p>
      <p className={`${big ? "readout text-[26px] font-semibold leading-tight" : "text-[14px] font-semibold leading-snug"} break-words text-white`}>{value}</p>
    </div>
  );
}

/** Interactive front/back preview of the Apple/Google Wallet "Digital Service Sticker". */
export function WalletPassPreview({ pass, version, qr, compact = false, updatedAt }: { pass: ServiceStickerPass; version: number; qr?: string | null; compact?: boolean; updatedAt?: string | null }) {
  const [flipped, setFlipped] = useState(false);
  const primary = pass.primary[0];
  const front = (
    <div className="flip-face flex h-full flex-col rounded-[14px] p-4 text-white shadow-sheet" style={{ background: pass.brandColour }}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-wide text-[13px] font-bold leading-tight">{pass.logoText}</p>
        <p className="shrink-0 text-right text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/65">Service sticker</p>
      </div>
      <div className="mt-4">
        <Field label={primary?.label ?? "Vehicle"} value={primary?.value ?? ""} big />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        {pass.secondary.map((f) => (
          <Field key={f.key} label={f.label} value={f.value} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {pass.auxiliary.map((f) => (
          <Field key={f.key} label={f.label} value={f.value} />
        ))}
      </div>
      {!compact ? (
        <div className="mt-auto flex flex-col items-center pt-4">
          <div className="rounded-md bg-white p-2.5">
            {qr ? <div className="h-[108px] w-[108px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="h-[108px] w-[108px]" />}
          </div>
          <p className="mt-1.5 text-[11px] text-white/70">Scan to open your garage</p>
        </div>
      ) : null}
    </div>
  );
  if (compact)
    return (
      <div className="h-[236px]" aria-label={`Wallet pass for ${primary?.value}`}>
        {front}
      </div>
    );
  return (
    <div>
      <div className="flip-card mx-auto w-full max-w-[340px]">
        <div className={`flip-inner h-[452px] ${flipped ? "is-flipped" : ""}`}>
          <div className="absolute inset-0">{front}</div>
          <div className="flip-face flip-back overflow-y-auto rounded-[14px] bg-white p-4 text-sump shadow-sheet" aria-hidden={!flipped}>
            <p className="text-[13px] font-bold">{pass.organizationName}</p>
            <dl className="mt-2 divide-y divide-chalk">
              {pass.back.map((f) => (
                <div key={f.key} className="py-2">
                  <dt className="text-[11px] font-semibold text-slate">{f.label}</dt>
                  <dd className="break-words text-[13px] leading-snug">{f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="readout mt-2 text-[10.5px] text-slate">
              Serial {pass.serialNumber} · v{version}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-slate">
        <button type="button" className="btn btn-secondary min-h-10 px-3 text-[14px]" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
          <Icon name="flip" size={16} /> {flipped ? "Show front" : "Show back"}
        </button>
        <span className="readout text-[11.5px]">
          Pass v{version}
          {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleString("en-AU", { day: "2-digit", month: "2-digit", hour: "numeric", minute: "2-digit" })}` : ""}
        </span>
      </div>
    </div>
  );
}

export function LockScreenPush({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  const now = new Date();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center rounded-xl bg-[#1b2430] px-4 pt-8 text-white" role="dialog" aria-label="Lock-screen preview">
      <p className="text-[13px] font-semibold text-white/70">{now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
      <p className="font-tailgate mt-1 text-[64px] normal-case tracking-tight">{now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: false })}</p>
      <div className="push-enter mt-6 w-full max-w-[340px] rounded-2xl bg-white/90 px-3 py-2.5 text-sump shadow-sheet">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white">
            <Icon name="wallet" size={14} />
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-slate">Wallet</span>
          <span className="ml-auto text-[12px] text-slate">now</span>
        </div>
        <p className="mt-1.5 text-[14px] font-bold leading-tight">{title}</p>
        <p className="text-[14px] leading-snug">{message}</p>
      </div>
      <p className="mt-4 max-w-[300px] text-center text-[12px] text-white/60">Delivered free through Apple Push / Google Wallet when the pass updates. No app needed. SMS covers customers without Wallet.</p>
      <button type="button" className="btn mt-auto mb-6 border border-white/30 text-white" onClick={onDone}>
        Back to the pass
      </button>
    </div>
  );
}
