"use client";
import Link from "next/link";
import type { Severity } from "@/db/schema";
import { Rego } from "@/components/ui/Rego";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { InspectionDiagram } from "@/components/diagrams/InspectionDiagram";
import { EstimateBox } from "@/components/garage/QuoteParts";
import { formatDateTime } from "@/domain/format";

interface Item {
  id: string;
  title: string;
  severity: Severity;
  explanation: string;
  transcript: string | null;
  measurement: string | null;
  horizon: string | null;
  low: number | null;
  high: number | null;
  diagram: string | null;
  annotation: { x: number; y: number; label: string }[] | null;
  createdAt: string;
  vehicle: { id: string; rego: string; regoState: string; label: string };
}

export function DviQueue({ items }: { items: Item[] }) {
  const { call, pending, error } = useAction();
  return (
    <div>
      <h2 className="text-[22px] font-bold">Bay DVI review</h2>
      <p className="mt-1 max-w-[64ch] text-[15px] text-slate">Findings dictated in the bay land here first. Check the plain-English wording and the estimate, then publish to the customer’s garage.</p>
      <ErrorBanner error={error} />
      {items.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-chalk px-4 py-10 text-center text-slate">
          Nothing waiting. <Link className="font-semibold text-sump underline" href="/bay">Open the bay tablet</Link> and hold to dictate a finding.
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {items.map((f) => (
            <li key={f.id} className="rounded-md border border-chalk bg-bench px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge severity={f.severity} />
                <Rego rego={f.vehicle.rego} state={f.vehicle.regoState} size="sm" />
                <span className="text-[13px] text-slate">{f.vehicle.label}</span>
                <span className="readout ml-auto text-[12px] text-slate">{formatDateTime(f.createdAt)}</span>
              </div>
              <h3 className="mt-2 text-[17px] font-bold">{f.title}</h3>
              {f.transcript ? (
                <p className="mt-1 text-[13px] text-slate">
                  <Icon name="mic" size={14} className="mr-1 inline" />
                  Heard: “{f.transcript}”
                </p>
              ) : null}
              <p className="mt-2 text-[15px]">{f.explanation}</p>
              {f.diagram ? (
                <div className="mt-2">
                  <InspectionDiagram kind={f.diagram} severity={f.severity} measurement={f.measurement} title={f.title} annotations={f.annotation} />
                </div>
              ) : null}
              {f.low != null && f.high != null ? (
                <div className="mt-2">
                  <EstimateBox low={f.low} high={f.high} compact />
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary" disabled={pending} onClick={() => call(`/api/dvi/findings/${f.id}/publish`, { advisorName: "Kirsty Brennan" })}>
                  <Icon name="check" size={18} /> Publish to garage
                </button>
                <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => call(`/api/dvi/findings/${f.id}/publish`, { advisorName: "Kirsty Brennan", reject: true })}>
                  Discard
                </button>
                <Link href={`/?v=${f.vehicle.id}`} className="btn btn-quiet ml-auto">
                  Customer view
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
