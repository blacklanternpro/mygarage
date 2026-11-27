"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";

interface Result {
  to: string;
  firstName: string;
  body: string;
  link: string;
  token: string;
  expiresAt: string;
  sms: { messageId: string; segments: number; costCents: number };
}

/** Walks the Stage 1 passwordless entry: SMS → tap → device check → garage. */
export function MagicLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const r = await fetch("/api/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r && !r.error) {
      setRes(r);
      setStep(1);
    }
  };
  const close = () => {
    setStep(0);
    setRes(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="SMS magic-link flow" subtitle="How a customer gets into their garage. No app, no password.">
      <ol className="space-y-4 text-sump">
        <li className="flex gap-3">
          <span className="readout mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sump text-[12px] text-white">1</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The workshop publishes a report</p>
            <p className="text-[14px] text-slate">The customer gets one SMS from the workshop’s registered Sender ID.</p>
            {step === 0 ? (
              <button type="button" className="btn btn-primary mt-3" onClick={send} disabled={busy}>
                <Icon name="message" size={18} /> {busy ? "Sending…" : "Send the SMS to Bec"}
              </button>
            ) : null}
            {res ? (
              <div className="mt-3 rounded-xl bg-stone p-3">
                <p className="readout text-[11px] text-slate">SWMech4x4 · now</p>
                <p className="mt-1 max-w-[30ch] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[14px] leading-snug shadow-sm">{res.body}</p>
                <p className="readout mt-2 text-[11px] text-slate">
                  To {res.to} · {res.sms.segments} segment(s) · modelled cost {res.sms.costCents}c via Texto (mock) · id {res.sms.messageId}
                </p>
              </div>
            ) : null}
          </div>
        </li>
        <li className={`flex gap-3 ${step < 1 ? "opacity-40" : ""}`}>
          <span className="readout mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sump text-[12px] text-white">2</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">One tap verifies the device</p>
            <p className="text-[14px] text-slate">Stage 2 issues a single-use, hashed token that expires in 15 minutes and binds a session cookie to the household.</p>
            {step === 1 && res ? (
              <button type="button" className="btn btn-secondary mt-3" onClick={() => setStep(2)}>
                <Icon name="lock" size={18} /> Tap the link
              </button>
            ) : null}
            {step >= 2 && res ? (
              <p className="readout mt-2 text-[12px] text-rag-green">
                Token {res.token.slice(0, 10)}… verified · expires {new Date(res.expiresAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
              </p>
            ) : null}
          </div>
        </li>
        <li className={`flex gap-3 ${step < 2 ? "opacity-40" : ""}`}>
          <span className="readout mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sump text-[12px] text-white">3</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The household garage opens</p>
            <p className="text-[14px] text-slate">All three vehicles, the shop’s branding and the Add to Wallet prompt.</p>
            {step === 2 ? (
              <button
                type="button"
                className="btn btn-brand mt-3"
                onClick={() => {
                  close();
                  router.push("/");
                }}
              >
                <Icon name="car" size={18} /> Open Bec’s garage
              </button>
            ) : null}
          </div>
        </li>
      </ol>
    </Sheet>
  );
}
