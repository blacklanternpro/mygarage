"use client";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/domain/format";
import { Bubble, Composer } from "./MessageThread";
import { FixedQuoteCard } from "./QuoteParts";
import type { GarageData, SheetState } from "./types";

const STATUS: Record<string, string> = { NEW: "Sent to the workshop", TRIAGED: "Workshop is pricing it", QUOTED: "Fixed quote ready", CLOSED: "Closed" };

export function ModThreads({ data, open, signer }: { data: GarageData; open: (s: SheetState) => void; signer: string }) {
  const { call, pending, error } = useAction();
  const threads = data.detail.modThreads;
  if (!threads.length) return null;
  return (
    <section aria-labelledby="mods-h" className="mt-8">
      <h2 id="mods-h" className="rule-heavy pt-2 text-[19px] font-bold">
        Modification quotes
      </h2>
      <div className="mt-3 space-y-4">
        {threads.map(({ request: r, messages, quote }) => {
          const paid = !!quote && data.paidQuoteIds.includes(quote.id);
          return (
            <article key={r.id} className="rounded-md border border-chalk bg-bench px-3.5 py-3" aria-labelledby={`mod-${r.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`mod-${r.id}`} className="text-[17px] font-bold">
                  {r.title}
                </h3>
                <span className="text-[13px] font-semibold text-slate">{STATUS[r.status] ?? r.status}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-slate">
                Requested {formatDate(r.createdAt)} · {r.budgetBand ? `Budget ${r.budgetBand}` : "No budget given"}
              </p>
              <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-chalk bg-white px-2 py-1 text-[12px]">
                <Icon name="link" size={13} /> Attached automatically: <span className="readout">VIN {r.vinSnapshot}</span> <span>{r.variantSnapshot}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} />
                ))}
              </ul>
              {quote ? (
                <div className="mt-3">
                  <FixedQuoteCard quote={quote} licence={data.licence} paid={paid}>
                    {quote.status === "ISSUED" ? (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => open({ kind: "approve", quoteId: quote.id })}>
                          <Icon name="check" size={18} /> Approve fixed quote
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => open({ kind: "declineQuote", quoteId: quote.id })}>
                          Not now
                        </button>
                      </>
                    ) : quote.status === "APPROVED" && !paid ? (
                      <button type="button" className="btn btn-brand" onClick={() => open({ kind: "checkout", quoteId: quote.id })}>
                        Pay now or in instalments
                      </button>
                    ) : null}
                  </FixedQuoteCard>
                </div>
              ) : null}
              <ErrorBanner error={error} />
              <Composer
                pending={pending}
                placeholder={`Reply about the ${r.title.toLowerCase()}`}
                onSend={async (body) => !!(await call("/api/messages", { vehicleId: r.vehicleId, thread: "MOD", modQuoteRequestId: r.id, authorRole: "CUSTOMER", authorName: signer || "Customer", body }))}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
