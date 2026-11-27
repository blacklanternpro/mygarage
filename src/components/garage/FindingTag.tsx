"use client";
import { useState } from "react";
import type { FindingView } from "@/domain/garage";
import { StatusBadge, TAG_COLOUR } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { InspectionDiagram } from "@/components/diagrams/InspectionDiagram";
import { CATEGORY_LABELS } from "@/domain/categories";
import { formatAudRange, formatDate } from "@/domain/format";
import { EstimateBox, FixedQuoteCard } from "./QuoteParts";
import type { SheetState } from "./types";

interface Props {
  finding: FindingView;
  licence: string;
  paid: boolean;
  open: (s: SheetState) => void;
  requestQuote: (findingId: string) => void;
  busyId: string | null;
}

function StatusLine({ f }: { f: FindingView }) {
  const base = "flex items-start gap-1.5 text-[13px] font-semibold leading-snug";
  switch (f.status) {
    case "PLANNED":
      return (
        <p className={`${base} text-sump`}>
          <Icon name="clock" size={16} className="mt-px shrink-0" /> Reminder set for {f.plannedRemindAt ? formatDate(f.plannedRemindAt) : "later"}. We'll nudge you on your lock screen.
        </p>
      );
    case "QUOTE_REQUESTED":
      return (
        <p className={`${base} text-sump`}>
          <Icon name="file" size={16} className="mt-px shrink-0" /> Fixed quote requested. The workshop will re-inspect and price the parts.
        </p>
      );
    case "BOOKED":
      return (
        <p className={`${base} text-rag-green`}>
          <Icon name="calendar" size={16} className="mt-px shrink-0" /> Booked in. Watch your messages for confirmation.
        </p>
      );
    case "DECLINED":
      return (
        <p className={`${base} ${f.severity === "URGENT_RED" ? "text-rag-red" : "text-slate"}`}>
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {f.severity === "URGENT_RED" ? "Declined against the workshop's advice. Unsafe vehicle acknowledgement signed." : "Declined for now. It stays on your watch-list."}
        </p>
      );
    default:
      return null;
  }
}

export function FindingTag({ finding: f, licence, paid, open, requestQuote, busyId }: Props) {
  const red = f.severity === "URGENT_RED";
  const [showVisual, setShowVisual] = useState(red);
  const quote = f.quote && (f.quote.status === "ISSUED" || f.quote.status === "APPROVED") ? f.quote : null;
  const hasEstimate = f.estimateLowCents != null && f.estimateHighCents != null;
  const canDecide = ["OPEN", "PLANNED", "QUOTE_REQUESTED", "DECLINED", "QUOTED"].includes(f.status);
  const busy = busyId === f.id;

  return (
    <article className={`job-tag ${red ? "pb-4 pt-3.5" : "pb-3.5 pt-3"} pl-[18px] pr-3.5`} style={{ ["--tag-colour" as string]: TAG_COLOUR[f.severity] }} aria-labelledby={`f-${f.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge severity={f.severity} />
        <span className="text-[13px] font-semibold text-slate">{CATEGORY_LABELS[f.category] ?? f.category}</span>
        {f.horizonText ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-slate">
            <Icon name="clock" size={14} /> {f.horizonText}
          </span>
        ) : null}
      </div>
      <h3 id={`f-${f.id}`} className={`mt-2 font-bold leading-tight ${red ? "text-[20px]" : "text-[17px]"}`}>
        {f.title}
      </h3>
      {f.measurement ? <p className="readout mt-1 text-[13px] text-slate">{f.measurement}</p> : null}
      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed">{f.customerExplanation}</p>

      {f.diagram ? (
        <div className="mt-3">
          {showVisual ? (
            <InspectionDiagram kind={f.diagram} severity={f.severity} measurement={f.measurement} title={f.title} annotations={f.annotation} />
          ) : (
            <button type="button" className="btn-quiet -ml-2 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold" onClick={() => setShowVisual(true)} aria-expanded={false}>
              <Icon name="eye" size={16} /> Show inspection visual
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {quote ? (
          <FixedQuoteCard quote={quote} licence={licence} paid={paid}>
            {quote.status === "ISSUED" ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => open({ kind: "approve", quoteId: quote.id })}>
                  <Icon name="check" size={18} /> Approve fixed quote
                </button>
                <button type="button" className={`btn ${red ? "btn-danger" : "btn-secondary"}`} onClick={() => open(red ? { kind: "refuse", findingId: f.id } : { kind: "declineQuote", quoteId: quote.id })}>
                  Decline
                </button>
              </>
            ) : !paid ? (
              <>
                <button type="button" className="btn btn-brand" onClick={() => open({ kind: "checkout", quoteId: quote.id })}>
                  Pay now
                </button>
                {f.status !== "BOOKED" ? (
                  <button type="button" className="btn btn-secondary" onClick={() => open({ kind: "book", findingIds: [f.id] })}>
                    <Icon name="calendar" size={18} /> Book it in
                  </button>
                ) : null}
              </>
            ) : null}
          </FixedQuoteCard>
        ) : null}
        {quote && hasEstimate ? (
          <p className="text-[12.5px] text-slate">
            This Fixed Quote replaces the indicative estimate of <span className="readout">{formatAudRange(f.estimateLowCents!, f.estimateHighCents!)}</span> given at inspection.
          </p>
        ) : null}
        {!quote && hasEstimate ? <EstimateBox low={f.estimateLowCents!} high={f.estimateHighCents!} /> : null}
        <StatusLine f={f} />
      </div>

      {!quote && canDecide ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`btn ${red ? "btn-primary" : "btn-secondary"}`} onClick={() => open({ kind: "book", findingIds: [f.id] })}>
            <Icon name="calendar" size={18} /> Book it in
          </button>
          {f.status !== "QUOTE_REQUESTED" ? (
            <button type="button" className="btn btn-secondary" onClick={() => requestQuote(f.id)} disabled={busy}>
              <Icon name="file" size={18} /> {busy ? "Requesting…" : "Request fixed quote"}
            </button>
          ) : null}
        </div>
      ) : null}
      {canDecide && f.status !== "DECLINED" ? (
        <div className="mt-2 flex flex-wrap gap-x-1 gap-y-0">
          <button type="button" className="btn btn-quiet min-h-11 text-[14px]" onClick={() => open({ kind: "plan", findingId: f.id })}>
            Plan for later
          </button>
          <button type="button" className="btn btn-quiet min-h-11 text-[14px]" onClick={() => open({ kind: "resolved", findingId: f.id })}>
            Mark resolved elsewhere
          </button>
          {red && !quote ? (
            <button type="button" className="btn btn-quiet min-h-11 text-[14px] text-rag-red" onClick={() => open({ kind: "refuse", findingId: f.id })}>
              Decline repair
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
