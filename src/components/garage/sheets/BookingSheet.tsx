"use client";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatAudRange, formatShortDay } from "@/domain/format";
import type { GarageData } from "../types";

const DROP_OFF = ["7:30 – 8:30 am", "8:30 – 10:00 am", "Night before (key drop box)"];

export function BookingSheet({ data, preselected, onClose }: { data: GarageData; preselected: string[]; onClose: () => void }) {
  const d = data.detail;
  const v = d.card.vehicle;
  const open = [...d.red, ...d.amber].filter((f) => ["OPEN", "PLANNED", "QUOTE_REQUESTED", "QUOTED", "APPROVED", "DECLINED"].includes(f.status));
  const [ticked, setTicked] = useState<string[]>(preselected.filter((id) => open.some((f) => f.id === id)));
  const [logbook, setLogbook] = useState(preselected.length === 0);
  const [day, setDay] = useState(data.bookingDays[1] ?? data.bookingDays[0]);
  const [drop, setDrop] = useState(DROP_OFF[0]);
  const [loan, setLoan] = useState(false);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const { call, pending, error } = useAction();
  const serviceType = logbook && ticked.length ? "LOGBOOK_AND_REPAIR" : logbook ? "LOGBOOK" : "REPAIR";
  const canSubmit = logbook || ticked.length > 0;
  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? "Booking request sent" : `Book the ${v.model} in`}
      subtitle={done ? undefined : `${v.rego} · ${data.workshop.name}`}
      footer={
        done ? (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!canSubmit || pending}
            onClick={async () => {
              const r = await call("/api/bookings", { vehicleId: v.id, serviceType, findingIds: ticked, requestedDate: day, dropOff: drop, loanCar: loan, notes: notes || undefined });
              if (r) setDone(true);
            }}
          >
            <Icon name="calendar" size={18} /> {pending ? "Sending…" : `Request ${formatShortDay(day)}`}
          </button>
        )
      }
    >
      {done ? (
        <SuccessBanner>
          Thanks. {data.workshop.name} will confirm {formatShortDay(day)} by SMS{loan ? " and have a loan car ready" : ""}. You’ll see it in your messages too.
        </SuccessBanner>
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="label">What needs doing?</legend>
            <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-[1.5px] px-3 py-2 ${logbook ? "border-sump bg-white" : "border-chalk"}`}>
              <input type="checkbox" className="h-6 w-6 accent-sump" checked={logbook} onChange={(e) => setLogbook(e.target.checked)} />
              <span className="font-semibold">Logbook service</span>
            </label>
            {open.length ? <p className="mb-1.5 mt-3 text-[13px] font-semibold text-slate">Add items from your watch-list</p> : null}
            <div className="space-y-2">
              {open.map((f) => (
                <label key={f.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border-[1.5px] px-3 py-2 ${ticked.includes(f.id) ? "border-sump bg-white" : "border-chalk"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-6 w-6 shrink-0 accent-sump"
                    checked={ticked.includes(f.id)}
                    onChange={() => setTicked((t) => (t.includes(f.id) ? t.filter((x) => x !== f.id) : [...t, f.id]))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge severity={f.severity} />
                      <span className="font-semibold">{f.title}</span>
                    </span>
                    {f.quote?.status === "APPROVED" ? (
                      <span className="block text-[13px] text-rag-green">Fixed quote approved</span>
                    ) : f.estimateLowCents != null && f.estimateHighCents != null ? (
                      <span className="block text-[13px] text-slate">
                        Indicative <span className="readout">{formatAudRange(f.estimateLowCents, f.estimateHighCents)}</span>, non-binding
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Day</legend>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {data.bookingDays.map((dd) => (
                <button
                  type="button"
                  key={dd}
                  onClick={() => setDay(dd)}
                  aria-pressed={day === dd}
                  className={`readout h-12 shrink-0 rounded-md border-[1.5px] px-3 text-[13px] font-semibold ${day === dd ? "border-sump bg-sump text-white" : "border-chalk bg-white"}`}
                >
                  {formatShortDay(dd)}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="drop">
              Drop-off
            </label>
            <select id="drop" className="field" value={drop} onChange={(e) => setDrop(e.target.value)}>
              {DROP_OFF.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border-[1.5px] border-chalk px-3 py-2">
            <span>
              <span className="block font-semibold">I need a loan car</span>
              <span className="block text-[13px] text-slate">Subject to availability. We’ll confirm.</span>
            </span>
            <input type="checkbox" role="switch" className="h-6 w-6 accent-sump" checked={loan} onChange={(e) => setLoan(e.target.checked)} />
          </label>
          <div>
            <label className="label" htmlFor="notes">
              Anything else? (optional)
            </label>
            <textarea id="notes" className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Noises, warning lights, pick-up times…" />
          </div>
          {!canSubmit ? <p className="text-[13px] text-slate">Tick the logbook service or at least one item.</p> : null}
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}
