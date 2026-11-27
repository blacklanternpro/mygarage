import type { FixedQuote, LineItem } from "@/db/schema";
import { ACL_ESTIMATE_LABEL, FIXED_QUOTE_TERMS } from "@/domain/compliance";
import { formatAudExact, formatAudRange, formatDate, totalsFromLineItems } from "@/domain/format";
import { LicenceTag } from "@/components/ui/LicenceTag";
import { Icon } from "@/components/ui/Icon";

/** Dashed = indicative. Always carries the exact ACL badge. */
export function EstimateBox({ low, high, compact = false, note }: { low: number; high: number; compact?: boolean; note?: string }) {
  return (
    <div className={`estimate-box ${compact ? "px-3 py-2" : "px-3.5 py-3"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-slate">Indicative estimate</span>
        <span className="readout text-[19px] font-semibold text-sump">
          {formatAudRange(low, high)} <span className="font-sans text-[12px] font-medium text-slate">inc. GST</span>
        </span>
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold leading-snug text-sump" data-acl-label>
        <Icon name="tag" size={14} className="mt-px shrink-0" />
        {ACL_ESTIMATE_LABEL}
      </p>
      {note ? <p className="mt-1 text-[12px] text-slate">{note}</p> : null}
    </div>
  );
}

function qty(li: LineItem) {
  if (li.kind === "LABOUR" && li.hours != null && li.rateCents != null) return `${li.hours} h × ${formatAudExact(li.rateCents)}`;
  return li.qty === 1 ? "1" : `${li.qty} × ${formatAudExact(li.unitCents)}`;
}

export function LineItemsTable({ items, dense = false, checked, onToggle }: { items: LineItem[]; dense?: boolean; checked?: string[]; onToggle?: (id: string) => void }) {
  return (
    <table className={`w-full border-collapse ${dense ? "text-[13px]" : "text-[14px]"}`}>
      <thead className="sr-only">
        <tr>
          {onToggle ? <th>Approve</th> : null}
          <th>Item, quantity or hours</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((li) => {
          const on = checked ? checked.includes(li.id) : true;
          return (
            <tr key={li.id} className={`border-b border-chalk/70 align-top last:border-0 ${on ? "" : "text-slate line-through"}`}>
              {onToggle ? (
                <td className="w-10 py-2 pr-1">
                  <input
                    type="checkbox"
                    className="h-6 w-6 accent-sump"
                    checked={on}
                    onChange={() => onToggle(li.id)}
                    aria-label={`Approve ${li.description}`}
                  />
                </td>
              ) : null}
              <td className="py-2 pr-3">
                <span className="block leading-snug">{li.description}</span>
                <span className="text-[12px] text-slate">
                  {li.kind === "LABOUR" ? "Labour" : li.kind === "FEE" ? "Fee" : "Part"} <span className="readout">{qty(li)}</span>
                </span>
              </td>
              <td className="readout whitespace-nowrap py-2 text-right">{formatAudExact(li.totalCents)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TotalsBlock({ items, approved }: { items: LineItem[]; approved?: string[] }) {
  const t = totalsFromLineItems(approved ? items.filter((i) => approved.includes(i.id)) : items);
  return (
    <dl className="readout mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[13px]">
      <dt className="font-sans text-slate">Subtotal (ex GST)</dt>
      <dd className="text-right">{formatAudExact(t.subtotalCents)}</dd>
      <dt className="font-sans text-slate">GST</dt>
      <dd className="text-right">{formatAudExact(t.gstCents)}</dd>
      <dt className="font-sans text-[15px] font-bold">Total inc. GST</dt>
      <dd className="text-right text-[17px] font-bold">{formatAudExact(t.totalCents)}</dd>
    </dl>
  );
}

const STATUS_CHIP: Record<FixedQuote["status"], string> = {
  ISSUED: "Awaiting your approval",
  APPROVED: "Approved",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

/** Solid + double rule = binding. Quote number, itemised lines, GST, validity, issuer, licence. */
export function FixedQuoteCard({ quote, licence, paid, children }: { quote: FixedQuote; licence: string; paid?: boolean; children?: React.ReactNode }) {
  const approved = quote.approvedLineIds ?? undefined;
  return (
    <section className="fixed-quote px-3.5 pb-3.5 pt-4" aria-label={`Fixed Quote ${quote.quoteNumber}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold leading-tight">Fixed Quote</p>
          <p className="readout text-[12.5px] text-slate">{quote.quoteNumber}</p>
        </div>
        <span
          className={`rounded-[3px] px-1.5 py-1 text-[12px] font-semibold leading-none ${
            quote.status === "APPROVED" ? "bg-rag-green text-white" : quote.status === "DECLINED" ? "bg-stone text-slate" : "bg-sump text-white"
          }`}
        >
          {paid ? "Approved and paid" : STATUS_CHIP[quote.status]}
        </span>
      </div>
      <p className="mt-2 font-semibold leading-snug">{quote.title}</p>
      <div className="mt-1">
        <LineItemsTable items={quote.lineItems} dense checked={quote.status === "APPROVED" ? approved : undefined} />
      </div>
      <TotalsBlock items={quote.lineItems} approved={quote.status === "APPROVED" ? approved : undefined} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate">
        <span>Valid until <span className="readout text-sump">{formatDate(quote.validUntil)}</span></span>
        <span>Issued by {quote.issuedBy}</span>
        <LicenceTag label={licence} tone="plain" />
      </div>
      {quote.status === "ISSUED" ? <p className="mt-2 text-[12px] leading-snug text-slate">{FIXED_QUOTE_TERMS}</p> : null}
      {quote.status === "APPROVED" && quote.decidedAt ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-rag-green">
          <Icon name="shield" size={15} /> Signed and timestamped {formatDate(quote.decidedAt)}. Stored in the workshop’s compliance vault.
        </p>
      ) : null}
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </section>
  );
}
