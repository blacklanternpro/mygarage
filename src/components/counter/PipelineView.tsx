"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FindingStatus, Severity } from "@/db/schema";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Rego } from "@/components/ui/Rego";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import { formatAud, formatAudRange, maskMobile } from "@/domain/format";
import { STATUS_LABEL } from "@/domain/status";

export interface PipelineRow {
  findingId: string;
  vehicleId: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  category: string;
  low: number;
  high: number;
  valueCents: number;
  ageDays: number;
  hours: number;
  score: number;
  rego: string;
  regoState: string;
  vehicle: string;
  customer: string;
  mobile: string | null;
  sms: string;
  contacted: boolean;
}

export function PipelineView({ rows, plan, quietDay, quietDayLabel, totals, sentCount }: { rows: PipelineRow[]; plan: string[]; quietDay: string; quietDayLabel: string; totals: { recoverableCents: number; count: number; redCount: number; redCents: number; declinedCount: number; vehicles: number }; sentCount: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState<{ count: number; cost: number } | null>(null);
  const { call, pending, error } = useAction<{ sent: unknown[]; totalCostCents: number }>();
  const picked = useMemo(() => rows.filter((r) => selected.includes(r.findingId)), [rows, selected]);
  const hours = picked.reduce((s, r) => s + r.hours, 0);
  const value = picked.reduce((s, r) => s + r.valueCents, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold">Rainy-day pipeline</h2>
          <p className="mt-1 max-w-[64ch] text-[15px] text-slate">Every open Red and Amber estimate across your customers, ranked by value and how long it’s been waiting. No trawling through closed job cards.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary h-14 px-5 text-[16px]"
          onClick={() => {
            setSelected(plan);
            setPreview(true);
          }}
        >
          <Icon name="calendar" /> Fill quiet {quietDayLabel.split(" ")[0]} bay
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-chalk bg-chalk md:grid-cols-4">
        <div className="bg-bench px-4 py-3">
          <dt className="text-[12px] font-semibold text-slate">Recoverable (estimate midpoints)</dt>
          <dd className="readout text-[28px] font-semibold">{formatAud(totals.recoverableCents, { whole: true })}</dd>
        </div>
        <div className="bg-bench px-4 py-3">
          <dt className="text-[12px] font-semibold text-slate">Open items</dt>
          <dd className="readout text-[28px] font-semibold">{totals.count}</dd>
          <dd className="text-[12px] text-slate">across {totals.vehicles} vehicles</dd>
        </div>
        <div className="bg-bench px-4 py-3">
          <dt className="text-[12px] font-semibold text-slate">Urgent safety items</dt>
          <dd className="readout text-[28px] font-semibold text-rag-red">{totals.redCount}</dd>
          <dd className="text-[12px] text-slate">{formatAud(totals.redCents, { whole: true })} · {totals.declinedCount} declined with sign-off</dd>
        </div>
        <div className="bg-bench px-4 py-3">
          <dt className="text-[12px] font-semibold text-slate">Campaign messages sent</dt>
          <dd className="readout text-[28px] font-semibold">{sentCount}</dd>
        </div>
      </dl>

      <div className="mt-5 overflow-x-auto rounded-md border border-chalk bg-bench">
        <table className="w-full min-w-[880px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b-2 border-sump text-left">
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="py-2 pr-3 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold">Item</th>
              <th className="py-2 pr-3 font-semibold">Vehicle</th>
              <th className="py-2 pr-3 font-semibold">Customer</th>
              <th className="py-2 pr-3 text-right font-semibold">Estimate</th>
              <th className="py-2 pr-3 text-right font-semibold">Waiting</th>
              <th className="py-2 pr-3 text-right font-semibold">Bay hrs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.findingId} className={`border-b border-chalk align-top ${selected.includes(r.findingId) ? "bg-white" : ""}`}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-sump"
                    aria-label={`Select ${r.title} for ${r.customer}`}
                    checked={selected.includes(r.findingId)}
                    onChange={() => setSelected((s) => (s.includes(r.findingId) ? s.filter((x) => x !== r.findingId) : [...s, r.findingId]))}
                  />
                </td>
                <td className="readout py-2.5 pr-3 text-slate">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge severity={r.severity} />
                    <span className="font-semibold">{r.title}</span>
                  </div>
                  <span className="text-[12px] text-slate">
                    {STATUS_LABEL[r.status]}
                    {r.contacted ? " · contacted" : ""}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <Rego rego={r.rego} state={r.regoState} size="sm" />
                  <span className="block text-[12px] text-slate">{r.vehicle}</span>
                </td>
                <td className="py-2.5 pr-3">
                  {r.customer}
                  {r.mobile ? <span className="readout block text-[12px] text-slate">{maskMobile(r.mobile)}</span> : null}
                </td>
                <td className="readout py-2.5 pr-3 text-right">{formatAudRange(r.low, r.high)}</td>
                <td className="readout py-2.5 pr-3 text-right">{r.ageDays} d</td>
                <td className="readout py-2.5 pr-3 text-right">{r.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.length ? (
        <div className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-3 rounded-md border border-sump bg-white px-4 py-3 shadow-sheet">
          <span className="text-[14px] font-semibold">
            {selected.length} selected · <span className="readout">{hours.toFixed(1)} h</span> · <span className="readout">{formatAud(value, { whole: true })}</span>
          </span>
          <button type="button" className="btn btn-primary ml-auto" onClick={() => setPreview(true)}>
            Preview messages
          </button>
        </div>
      ) : null}

      <Sheet
        open={preview}
        onClose={() => {
          setPreview(false);
          setSent(null);
        }}
        wide
        title={sent ? "Campaign sent" : `Fill ${quietDayLabel} with ${picked.length} jobs`}
        subtitle={sent ? undefined : <>Fits a 7.5-hour bay: <span className="readout">{hours.toFixed(1)} h</span>, about <span className="readout">{formatAud(value, { whole: true })}</span> of work. One SMS per customer from your Sender ID.</>}
        footer={
          sent ? (
            <Link href="/counter?tab=inbox" className="btn btn-primary w-full">
              Watch the replies in the triage inbox
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={pending || !picked.length}
              onClick={async () => {
                const r = await call("/api/pipeline/campaign", { date: quietDay, findingIds: picked.map((p) => p.findingId), advisorName: "Kirsty Brennan" });
                if (r) setSent({ count: r.sent.length, cost: r.totalCostCents });
              }}
            >
              <Icon name="message" size={18} /> {pending ? "Sending…" : `Send ${picked.length} messages`}
            </button>
          )
        }
      >
        {sent ? (
          <SuccessBanner>
            {sent.count} messages sent through the SMS adapter (mock Texto). Modelled cost {sent.cost}c. Each one is logged against the customer’s vehicle thread.
          </SuccessBanner>
        ) : (
          <ul className="space-y-3">
            {picked.map((p) => (
              <li key={p.findingId} className="rounded-md border border-chalk bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-semibold">{p.customer}</span>
                  <span className="readout text-slate">{p.mobile ? maskMobile(p.mobile) : ""}</span>
                  <Rego rego={p.rego} state={p.regoState} size="sm" />
                  <span className="readout ml-auto text-slate">{p.hours} h</span>
                </div>
                <p className="mt-1.5 rounded-2xl rounded-tl-sm bg-stone px-3 py-2 text-[14px] leading-snug">{p.sms}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <ErrorBanner error={error} />
        </div>
      </Sheet>
    </div>
  );
}
