"use client";
import Link from "next/link";
import { useState } from "react";
import type { Severity } from "@/db/schema";
import { Rego } from "@/components/ui/Rego";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { formatAudRange, formatDateTime, formatShortDay } from "@/domain/format";

interface BookingRow {
  id: string;
  status: string;
  serviceType: string;
  requestedDate: string;
  dropOff: string;
  loanCar: boolean;
  notes: string | null;
  items: string[];
  createdAt: string;
  vehicle: { id: string; rego: string; regoState: string; label: string; vin: string };
  customer: string;
}
interface ModRow {
  id: string;
  status: string;
  title: string;
  description: string;
  usage: string | null;
  budgetBand: string | null;
  vin: string;
  variant: string;
  photos: string[];
  productLink: string | null;
  createdAt: string;
  vehicle: { id: string; rego: string; regoState: string };
  customer: string;
}
interface QuoteReqRow {
  id: string;
  title: string;
  severity: Severity;
  low: number | null;
  high: number | null;
  vehicle: { id: string; rego: string; regoState: string; label: string };
  updatedAt: string;
}

const SERVICE: Record<string, string> = { LOGBOOK: "Logbook service", REPAIR: "Repairs", LOGBOOK_AND_REPAIR: "Logbook service + repairs" };

function ModCard({ m }: { m: ModRow }) {
  const { call, pending, error } = useAction();
  const [reply, setReply] = useState("");
  return (
    <article className="rounded-md border border-chalk bg-bench px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-[3px] px-1.5 py-1 text-[12px] font-semibold leading-none ${m.status === "NEW" ? "bg-sump text-white" : "bg-stone text-slate"}`}>{m.status === "NEW" ? "New" : m.status.toLowerCase()}</span>
        <h3 className="text-[16px] font-bold">{m.title}</h3>
        <span className="text-[13px] text-slate">{m.customer}</span>
        <span className="readout ml-auto text-[12px] text-slate">{formatDateTime(m.createdAt)}</span>
      </div>
      <div className="mt-2 grid gap-1 rounded border border-chalk bg-white px-3 py-2 text-[13px] sm:grid-cols-[auto_1fr]">
        <Rego rego={m.vehicle.rego} state={m.vehicle.regoState} size="sm" />
        <span className="sm:pl-2">
          <span className="readout">VIN {m.vin}</span> · {m.variant}
        </span>
      </div>
      <p className="mt-2 text-[15px]">{m.description}</p>
      <p className="mt-1 text-[13px] text-slate">
        {m.usage ? `Use: ${m.usage}. ` : ""}
        {m.budgetBand ? `Budget: ${m.budgetBand}.` : ""}
      </p>
      {m.photos.length ? (
        <ul className="mt-2 flex gap-2">
          {m.photos.map((k) => (
            <li key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media?key=${encodeURIComponent(k)}`} alt="Customer photo" className="h-20 w-20 rounded object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {m.status !== "CLOSED" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="sr-only" htmlFor={`reply-${m.id}`}>
            Reply
          </label>
          <input id={`reply-${m.id}`} className="field min-w-[240px] flex-1" placeholder="Reply to the customer (appears in their garage)" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={async () => {
              if (await call("/api/triage", { kind: "mod", id: m.id, action: "triage", reply: reply || undefined })) setReply("");
            }}
          >
            {reply ? "Send reply" : "Mark as pricing"}
          </button>
          <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call("/api/triage", { kind: "mod", id: m.id, action: "close" })}>
            Close
          </button>
        </div>
      ) : null}
      <ErrorBanner error={error} />
    </article>
  );
}

export function TriageInbox({ bookings, mods, quoteRequests }: { bookings: BookingRow[]; mods: ModRow[]; quoteRequests: QuoteReqRow[] }) {
  const { call, pending, error } = useAction();
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section aria-labelledby="mods-h">
        <h2 id="mods-h" className="text-[22px] font-bold">
          Modification &amp; custom quotes
        </h2>
        <p className="mt-1 text-[14px] text-slate">VIN and exact variant are attached by the customer’s garage. No phone tag to find out which ute.</p>
        <div className="mt-3 space-y-3">{mods.length ? mods.map((m) => <ModCard key={m.id} m={m} />) : <p className="text-slate">No quote requests.</p>}</div>
      </section>
      <section aria-labelledby="book-h" className="space-y-8">
        <div>
          <h2 id="book-h" className="text-[22px] font-bold">
            Booking requests
          </h2>
          <ul className="mt-3 space-y-3">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-md border border-chalk bg-bench px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Rego rego={b.vehicle.rego} state={b.vehicle.regoState} size="sm" />
                  <span className="font-semibold">{b.customer}</span>
                  <span className="text-[13px] text-slate">{b.vehicle.label}</span>
                  <span className={`ml-auto rounded-[3px] px-1.5 py-1 text-[12px] font-semibold leading-none ${b.status === "REQUESTED" ? "bg-sump text-white" : b.status === "CONFIRMED" ? "bg-rag-green text-white" : "bg-stone text-slate"}`}>{b.status.toLowerCase()}</span>
                </div>
                <p className="mt-2 text-[15px]">
                  <span className="font-semibold">{formatShortDay(b.requestedDate)}</span>, drop off {b.dropOff}
                  {b.loanCar ? ", loan car" : ""}. {SERVICE[b.serviceType]}
                  {b.items.length ? `: ${b.items.join(", ")}` : ""}.
                </p>
                {b.notes ? <p className="mt-1 text-[14px] text-slate">“{b.notes}”</p> : null}
                {b.status === "REQUESTED" ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => call("/api/triage", { kind: "booking", id: b.id, action: "confirm" })}>
                      <Icon name="check" size={18} /> Confirm &amp; text customer
                    </button>
                    <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call("/api/triage", { kind: "booking", id: b.id, action: "close" })}>
                      Can’t fit it
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
            {!bookings.length ? <li className="text-slate">No booking requests.</li> : null}
          </ul>
          <ErrorBanner error={error} />
        </div>
        <div>
          <h2 className="text-[22px] font-bold">Fixed quotes requested</h2>
          <ul className="mt-3 space-y-2">
            {quoteRequests.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-md border border-chalk bg-bench px-4 py-3">
                <StatusBadge severity={q.severity} />
                <span className="font-semibold">{q.title}</span>
                <Rego rego={q.vehicle.rego} state={q.vehicle.regoState} size="sm" />
                {q.low != null && q.high != null ? <span className="readout text-[13px] text-slate">est. {formatAudRange(q.low, q.high)}</span> : null}
                <Link href={`/?v=${q.vehicle.id}`} className="btn btn-quiet ml-auto text-[14px]">
                  View
                </Link>
              </li>
            ))}
            {!quoteRequests.length ? <li className="text-slate">None waiting. When a customer taps “Request fixed quote” it lands here.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
