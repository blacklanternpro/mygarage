"use client";
import { useState } from "react";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { formatAudExact } from "@/domain/format";

export function SettingsPanel({ settings, examples }: { settings: { bnplEnabled: boolean; bnplMinCents: number; paytoEnabled: boolean; cardEnabled: boolean }; examples: { amount: number; payto: number; card: number; afterpay: number; saving: number }[] }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const { call, pending, error } = useAction();
  const save = async (next: typeof s) => {
    setS(next);
    setSaved(false);
    if (await call("/api/settings", next)) setSaved(true);
  };
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
      <section>
        <h2 className="text-[22px] font-bold">Payment options</h2>
        <p className="mt-1 max-w-[60ch] text-[15px] text-slate">Since 1 October 2026 you can’t pass card fees on as a surcharge, so there’s no surcharge setting here. Steer customers to PayTo instead: the fee is capped at A$3.50.</p>
        <div className="mt-4 space-y-3">
          <Toggle label="PayTo (instant bank payment)" hint="Recommended first option for customers." on={s.paytoEnabled} onChange={(v) => save({ ...s, paytoEnabled: v })} />
          <Toggle label="Card, Apple Pay and Google Pay" hint="No surcharge. Stripe online rate 1.65% + A$0.30." on={s.cardEnabled} onChange={(v) => save({ ...s, cardEnabled: v })} />
          <Toggle label="Buy now, pay later (Afterpay, Zip)" hint="Costs you about 6%. Offer it only on bigger jobs that would otherwise be declined." on={s.bnplEnabled} onChange={(v) => save({ ...s, bnplEnabled: v })} />
          <div className={s.bnplEnabled ? "" : "opacity-50"}>
            <label className="label" htmlFor="bnpl-min">
              Only offer BNPL on jobs over
            </label>
            <select id="bnpl-min" className="field max-w-[220px]" disabled={!s.bnplEnabled} value={s.bnplMinCents} onChange={(e) => save({ ...s, bnplMinCents: parseInt(e.target.value, 10) })}>
              {[40000, 60000, 100000, 150000].map((c) => (
                <option key={c} value={c}>
                  {formatAudExact(c)}
                </option>
              ))}
            </select>
          </div>
          {saved ? <SuccessBanner>Saved. Customers see the change straight away.</SuccessBanner> : null}
          <ErrorBanner error={error} />
          {pending ? <p className="text-[13px] text-slate">Saving…</p> : null}
        </div>
      </section>
      <section>
        <h2 className="text-[22px] font-bold">What each option costs you</h2>
        <table className="mt-3 w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b-2 border-sump text-left">
              <th className="py-2 pr-2 font-semibold">Job total</th>
              <th className="py-2 pr-2 text-right font-semibold">PayTo</th>
              <th className="py-2 pr-2 text-right font-semibold">Card</th>
              <th className="py-2 pr-2 text-right font-semibold">Afterpay</th>
              <th className="py-2 text-right font-semibold">PayTo saves</th>
            </tr>
          </thead>
          <tbody className="readout">
            {examples.map((e) => (
              <tr key={e.amount} className="border-b border-chalk">
                <td className="py-2 pr-2">{formatAudExact(e.amount)}</td>
                <td className="py-2 pr-2 text-right">{formatAudExact(e.payto)}</td>
                <td className="py-2 pr-2 text-right">{formatAudExact(e.card)}</td>
                <td className="py-2 pr-2 text-right">{formatAudExact(e.afterpay)}</td>
                <td className="py-2 text-right font-semibold text-rag-green">{formatAudExact(e.saving)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex gap-2 text-[13px] text-slate">
          <Icon name="shield" size={16} className="mt-px shrink-0" /> Fees are your cost. The customer always pays exactly the quoted total.
        </p>
      </section>
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-md border-[1.5px] border-chalk bg-bench px-4 py-2">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-slate">{hint}</span>
      </span>
      <input type="checkbox" role="switch" aria-checked={on} className="h-6 w-6 accent-sump" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
