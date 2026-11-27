"use client";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import { WalletPassPreview, LockScreenPush } from "@/components/wallet/WalletPass";
import { aaaaRefusalPoints, ACL_ESTIMATE_LABEL, isFullName, type RefusalPointKey } from "@/domain/compliance";
import { availableRails } from "@/domain/payments";
import { formatAudExact, formatAudRange, formatDate, formatDateTime, formatKm, formatShortDay, totalsFromLineItems } from "@/domain/format";
import type { FindingView } from "@/domain/garage";
import type { FixedQuote } from "@/db/schema";
import { LineItemsTable, TotalsBlock } from "../QuoteParts";
import { BookingSheet } from "./BookingSheet";
import { ModQuoteSheet } from "./ModQuoteSheet";
import type { GarageData, SheetState } from "../types";

interface Props {
  data: GarageData;
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
  signer: string;
}

export function GarageSheets({ data, sheet, setSheet, signer }: Props) {
  const d = data.detail;
  const allFindings: FindingView[] = useMemo(() => [...d.red, ...d.amber, ...d.closed], [d]);
  const finding = sheet && "findingId" in sheet ? allFindings.find((f) => f.id === sheet.findingId) ?? null : null;
  const quote = sheet && "quoteId" in sheet ? d.quotes.find((q) => q.id === sheet.quoteId) ?? null : null;
  const close = () => setSheet(null);
  return (
    <>
      {sheet?.kind === "approve" && quote ? <ApproveSheet key={quote.id} quote={quote} data={data} signer={signer} onClose={close} onPay={() => setSheet({ kind: "checkout", quoteId: quote.id })} /> : null}
      {sheet?.kind === "refuse" && finding ? <RefusalSheet key={finding.id} finding={finding} data={data} signer={signer} onClose={close} onBook={() => setSheet({ kind: "book", findingIds: [finding.id] })} /> : null}
      {sheet?.kind === "declineQuote" && quote ? <DeclineQuoteSheet quote={quote} onClose={close} /> : null}
      {sheet?.kind === "plan" && finding ? <PlanSheet finding={finding} data={data} onClose={close} /> : null}
      {sheet?.kind === "resolved" && finding ? <ResolvedSheet finding={finding} onClose={close} /> : null}
      {sheet?.kind === "book" ? <BookingSheet data={data} preselected={sheet.findingIds} onClose={close} /> : null}
      {sheet?.kind === "mod" ? <ModQuoteSheet data={data} onClose={close} /> : null}
      {sheet?.kind === "checkout" && quote ? <CheckoutSheet quote={quote} data={data} onClose={close} /> : null}
      {sheet?.kind === "wallet" ? <WalletSheet data={data} onClose={close} /> : null}
    </>
  );
}

// ─── Approve Fixed Quote (line-by-line, typed name + drawn signature) ─────

function ApproveSheet({ quote, data, signer, onClose, onPay }: { quote: FixedQuote; data: GarageData; signer: string; onClose: () => void; onPay: () => void }) {
  const { call, pending, error } = useAction<{ approvedTotalCents: number; auditSeq: number; contentHash: string }>();
  const [lines, setLines] = useState(quote.lineItems.map((l) => l.id));
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [done, setDone] = useState<{ approvedTotalCents: number; auditSeq: number; contentHash: string } | null>(null);
  const total = totalsFromLineItems(quote.lineItems.filter((l) => lines.includes(l.id))).totalCents;
  const ready = lines.length > 0 && isFullName(name) && !!sig;
  const submit = async () => {
    const r = await call(`/api/quotes/${quote.id}/approve`, { signerName: name, signatureSvg: sig, approvedLineIds: lines });
    if (r) setDone(r);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? "Fixed quote approved" : `Approve ${quote.quoteNumber}`}
      subtitle={done ? undefined : quote.title}
      footer={
        done ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-brand flex-1" onClick={onPay}>
              Pay {formatAudExact(done.approvedTotalCents)}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Pay at pick-up
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary w-full" disabled={!ready || pending} onClick={submit}>
            <Icon name="check" size={18} /> {pending ? "Signing…" : `Approve and sign · ${formatAudExact(total)}`}
          </button>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <SuccessBanner>
            Approved and signed {formatDateTime(new Date())}. The workshop has been notified and will book it in.
          </SuccessBanner>
          <p className="text-[14px]">
            Your approval is stored in the workshop's compliance vault as entry <span className="readout">#{done.auditSeq}</span>, sealed with hash <span className="readout break-all text-[12px]">{done.contentHash.slice(0, 24)}…</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-slate">Untick anything you don't want done. You only authorise the ticked lines.</p>
          <LineItemsTable items={quote.lineItems} checked={lines} onToggle={(id) => setLines((ls) => (ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]))} />
          <TotalsBlock items={quote.lineItems} approved={lines} />
          <div>
            <label className="label" htmlFor="approve-name">
              Your full name
            </label>
            <input id="approve-name" className="field" autoComplete="name" placeholder={signer || "First and last name"} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <SignaturePad onChange={setSig} />
          <p className="text-[13px] leading-snug text-slate">
            By signing you authorise {data.workshop.name} ({data.licence}) to carry out the ticked work for {formatAudExact(total)} inc. GST. Any extra work needs a separate approval from you.
          </p>
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}

// ─── AAAA unsafe vehicle release acknowledgement ──────────────────────────

function RefusalSheet({ finding, data, signer, onClose, onBook }: { finding: FindingView; data: GarageData; signer: string; onClose: () => void; onBook: () => void }) {
  const points = aaaaRefusalPoints(finding);
  const { call, pending, error } = useAction();
  const [acks, setAcks] = useState<Record<RefusalPointKey, boolean>>({ unsafeToDrive: false, mechanicalReason: false, mechanicalDangers: false, safetyDangers: false, repairOrTowRecommended: false });
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const ticked = Object.values(acks).filter(Boolean).length;
  const ready = ticked === 5 && isFullName(name) && !!sig;
  const quote = finding.quote && finding.quote.status === "ISSUED" ? finding.quote : null;
  const submit = async () => {
    const refusal = { acknowledgements: acks, signerName: name, signatureSvg: sig, reason: reason || undefined };
    const r = await call(quote ? `/api/quotes/${quote.id}/decline` : `/api/findings/${finding.id}/decline`, { refusal });
    if (r) setDone(true);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={done ? "Acknowledgement signed" : "Unsafe vehicle acknowledgement"}
      subtitle={done ? undefined : <>Declining a safety-critical repair needs your signed acknowledgement (AAAA 5-point release).</>}
      footer={
        done ? (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <div className="space-y-2">
            <button type="button" className="btn btn-danger w-full bg-white" disabled={!ready || pending} onClick={submit}>
              {pending ? "Recording…" : ready ? "Sign and decline the repair" : `Complete all steps to decline (${ticked}/5 ticked)`}
            </button>
            <button type="button" className="btn btn-primary w-full" onClick={onBook}>
              <Icon name="calendar" size={18} /> Book the repair instead
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <SuccessBanner>Your acknowledgement is signed, timestamped and stored with {data.workshop.name}. You can still book the repair any time.</SuccessBanner>
          <p className="text-[14px]">
            Please don't drive further than you need to. To arrange a tow, call <a className="font-semibold underline" href={`tel:${data.workshop.phone.replace(/\D/g, "")}`}>{data.workshop.phone}</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border-[1.5px] border-rag-red bg-rag-red-wash px-3 py-2.5">
            <p className="font-bold">{finding.title}</p>
            {finding.measurement ? <p className="readout text-[13px]">{finding.measurement}</p> : null}
            <p className="mt-1 text-[14px]">{finding.customerExplanation}</p>
          </div>
          <fieldset>
            <legend className="label">Tick each point to confirm you understand it</legend>
            <ol className="mt-1 space-y-2">
              {points.map((p, i) => (
                <li key={p.key}>
                  <label className={`flex cursor-pointer gap-3 rounded-md border-[1.5px] px-3 py-2.5 ${acks[p.key] ? "border-sump bg-white" : "border-chalk bg-bench"}`}>
                    <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-sump" checked={acks[p.key]} onChange={(e) => setAcks((a) => ({ ...a, [p.key]: e.target.checked }))} />
                    <span>
                      <span className="block text-[14px] font-bold">
                        {i + 1}. {p.heading}
                      </span>
                      <span className="block text-[14px] leading-snug">{p.statement}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ol>
          </fieldset>
          <div>
            <label className="label" htmlFor="refuse-reason">
              Reason (optional)
            </label>
            <input id="refuse-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. getting a second opinion" />
          </div>
          <div>
            <label className="label" htmlFor="refuse-name">
              Your full name
            </label>
            <input id="refuse-name" className="field" autoComplete="name" placeholder={signer || "First and last name"} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <SignaturePad onChange={setSig} label="Sign to acknowledge" />
          <p className="text-[12.5px] text-slate">
            Recorded with the date, time and your signature by {data.workshop.name} ({data.licence}).
          </p>
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}

function DeclineQuoteSheet({ quote, onClose }: { quote: FixedQuote; onClose: () => void }) {
  const { call, pending, error } = useAction();
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Decline ${quote.quoteNumber}?`}
      subtitle={quote.title}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            Keep the quote
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={pending}
            onClick={async () => {
              if (await call(`/api/quotes/${quote.id}/decline`, {})) onClose();
            }}
          >
            Decline quote
          </button>
        </div>
      }
    >
      <p className="text-[15px]">The workshop will be told. Any watch-list items stay on your roadmap so you can come back to them.</p>
      <div className="mt-3">
        <ErrorBanner error={error} />
      </div>
    </Sheet>
  );
}

// ─── Plan for later / resolved elsewhere ──────────────────────────────────

function PlanSheet({ finding, data, onClose }: { finding: FindingView; data: GarageData; onClose: () => void }) {
  const { call, pending, error } = useAction<{ remindOn: string }>();
  const v = data.detail.card.vehicle;
  const t = data.detail.card.trigger;
  const [h, setH] = useState<"1M" | "3M" | "NEXT_SERVICE">("NEXT_SERVICE");
  const [done, setDone] = useState<string | null>(null);
  const options = [
    { id: "1M" as const, title: "In 1 month", sub: "A quick nudge" },
    { id: "3M" as const, title: "In 3 months", sub: "Time to budget for it" },
    { id: "NEXT_SERVICE" as const, title: "At my next service", sub: t.first ? `Around ${formatDate(t.first.date)}${v.nextServiceDueKm ? ` or ${formatKm(v.nextServiceDueKm)}` : ""}` : "When it's next due" },
  ];
  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? "Reminder set" : "Plan for later"}
      subtitle={finding.title}
      footer={
        done ? (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending}
            onClick={async () => {
              const r = await call(`/api/findings/${finding.id}/plan`, { horizon: h });
              if (r) setDone(r.remindOn);
            }}
          >
            <Icon name="clock" size={18} /> Remind me
          </button>
        )
      }
    >
      {done ? (
        <SuccessBanner>
          We'll remind you on {done} on your lock screen (Wallet) or by SMS. No pressure. It stays on your roadmap.
        </SuccessBanner>
      ) : (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="sr-only">When should we remind you?</legend>
            {options.map((o) => (
              <label key={o.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-[1.5px] px-3 py-2 ${h === o.id ? "border-sump bg-white" : "border-chalk"}`}>
                <input type="radio" name="horizon" className="h-5 w-5 accent-sump" checked={h === o.id} onChange={() => setH(o.id)} />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-[13px] text-slate">{o.sub}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {finding.estimateLowCents != null && finding.estimateHighCents != null ? (
            <p className="text-[13px] text-slate">
              Budget guide: <span className="readout text-sump">{formatAudRange(finding.estimateLowCents, finding.estimateHighCents)}</span> inc. GST. {ACL_ESTIMATE_LABEL}.
            </p>
          ) : null}
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}

function ResolvedSheet({ finding, onClose }: { finding: FindingView; onClose: () => void }) {
  const { call, pending, error } = useAction();
  const [note, setNote] = useState("");
  return (
    <Sheet
      open
      onClose={onClose}
      title="Mark resolved elsewhere"
      subtitle={finding.title}
      footer={
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={pending}
          onClick={async () => {
            if (await call(`/api/findings/${finding.id}/resolved`, { note: note || undefined })) onClose();
          }}
        >
          Mark as resolved
        </button>
      }
    >
      <p className="text-[15px]">Had it fixed somewhere else? That's fine. We'll take it off your watch-list and stop the reminders.</p>
      <label className="label mt-4" htmlFor="resolved-note">
        Where or when (optional)
      </label>
      <input id="resolved-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. tyre shop in Bunbury, last week" />
      {finding.severity === "URGENT_RED" ? <p className="mt-3 text-[13px] text-slate">For safety items the workshop may ask to see the other invoice at your next visit.</p> : null}
      <div className="mt-3">
        <ErrorBanner error={error} />
      </div>
    </Sheet>
  );
}

// ─── Checkout (post-1 Oct 2026: no surcharges, PayTo first) ────────────────

function CheckoutSheet({ quote, data, onClose }: { quote: FixedQuote; data: GarageData; onClose: () => void }) {
  const ids = quote.approvedLineIds ?? quote.lineItems.map((l) => l.id);
  const amount = totalsFromLineItems(quote.lineItems.filter((l) => ids.includes(l.id))).totalCents;
  const rails = availableRails(data.workshop, amount);
  const [rail, setRail] = useState(rails.find((r) => r.primary)?.rail ?? rails.find((r) => r.available)?.rail ?? "CARD");
  const { call, pending, error } = useAction<{ intent: { instructions?: string; id: string } }>();
  const [done, setDone] = useState<string | null>(null);
  const groups = [
    { key: "PAYTO", title: "Instant bank payment" },
    { key: "CARD", title: "Card and digital wallets" },
    { key: "BNPL", title: "Pay in instalments" },
  ] as const;
  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? "Payment received" : `Pay ${formatAudExact(amount)}`}
      subtitle={`${quote.quoteNumber} · ${quote.title}`}
      footer={
        done ? (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-brand w-full"
            disabled={pending || !rails.find((r) => r.rail === rail)?.available}
            onClick={async () => {
              const r = await call(`/api/quotes/${quote.id}/pay`, { rail });
              if (r) setDone(r.intent.instructions ?? "Paid.");
            }}
          >
            {pending ? "Processing…" : `Pay ${formatAudExact(amount)}`}
          </button>
        )
      }
    >
      {done ? (
        <SuccessBanner>
          {done} You paid exactly {formatAudExact(amount)}.
        </SuccessBanner>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const items = rails.filter((r) => r.group === g.key);
            return (
              <fieldset key={g.key}>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate">{g.title}</legend>
                <div className="space-y-2">
                  {items.map((r) => (
                    <label
                      key={r.rail}
                      className={`flex min-h-14 items-center gap-3 rounded-md border-[1.5px] px-3 py-2 ${!r.available ? "cursor-not-allowed border-dashed border-chalk opacity-60" : rail === r.rail ? "cursor-pointer border-sump bg-white" : "cursor-pointer border-chalk"}`}
                    >
                      <input type="radio" name="rail" className="h-5 w-5 accent-sump" disabled={!r.available} checked={rail === r.rail} onChange={() => setRail(r.rail)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {r.label}
                          {r.primary ? <span className="rounded-[3px] bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">Recommended</span> : null}
                        </span>
                        <span className="block text-[13px] text-slate">{r.available ? r.description : r.reason}</span>
                      </span>
                      <span className="readout shrink-0 text-[13px]">{formatAudExact(r.customerPaysCents)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <p className="flex gap-2 text-[13px] leading-snug text-slate">
            <Icon name="shield" size={16} className="mt-px shrink-0" />
            Card surcharges are banned in Australia from 1 October 2026. Every option costs you the same {formatAudExact(amount)}.
          </p>
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}

// ─── Wallet sticker ────────────────────────────────────────────────────────

function WalletSheet({ data, onClose }: { data: GarageData; onClose: () => void }) {
  const v = data.detail.card.vehicle;
  const { call, pending, error } = useAction();
  const [push, setPush] = useState<string | null>(null);
  const message =
    data.detail.card.nextServiceDays != null && data.detail.card.nextServiceDays <= 45
      ? `Your ${v.model} (${v.rego}) is due for a service on ${formatDate(v.nextServiceDueDate)}. Tap to book.`
      : data.detail.red.length
        ? `${data.detail.red[0].title} on your ${v.model}. Tap to see your fixed quote.`
        : `Your ${v.model} has ${data.detail.amber.length} item(s) to watch. Tap to plan ahead.`;
  return (
    <Sheet open onClose={onClose} title="Digital service sticker" subtitle="Replaces the windscreen sticker. Lives in Apple Wallet or Google Wallet and updates itself.">
      <div className="relative">
        {data.pass ? <WalletPassPreview pass={data.pass} version={data.passVersion} qr={data.qr} updatedAt={data.passUpdatedAt} /> : <p>No pass yet.</p>}
        {push ? <LockScreenPush title={data.workshop.name} message={push} onDone={() => setPush(null)} /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a className="btn btn-primary" href={`/api/wallet/${data.pass?.serialNumber}?format=apple`} target="_blank" rel="noreferrer">
          <Icon name="wallet" size={18} /> Add to Apple Wallet
        </a>
        <a className="btn btn-secondary" href={`/api/wallet/${data.pass?.serialNumber}?format=google`} target="_blank" rel="noreferrer">
          <Icon name="wallet" size={18} /> Add to Google Wallet
        </a>
      </div>
      <p className="mt-1.5 text-center text-[12px] text-slate">Stage 1 preview: opens the mock pass payload. Stage 2 signs a real pass.</p>
      <button
        type="button"
        className="btn btn-secondary mt-4 w-full"
        disabled={pending}
        onClick={async () => {
          if (await call("/api/wallet/push", { vehicleId: v.id, message })) setPush(message);
        }}
      >
        <Icon name="bolt" size={18} /> Simulate lock-screen service reminder
      </button>
      {data.lastPush ? (
        <p className="mt-2 text-[12.5px] text-slate">
          Last push {formatDateTime(data.lastPush.at)}: "{data.lastPush.message}"
        </p>
      ) : null}
      <div className="mt-2">
        <ErrorBanner error={error} />
      </div>
      <p className="mt-3 text-[12.5px] text-slate">
        Next service {formatShortDay(v.nextServiceDueDate ?? data.today)} · rego {formatDate(v.regoExpiry)} · {data.licence}
      </p>
    </Sheet>
  );
}
