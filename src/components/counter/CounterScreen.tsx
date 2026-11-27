import Link from "next/link";
import { appContext } from "@/lib/server";
import { getRainyDayPipeline, planQuietBay, campaignSms, defaultQuietDay, campaignHistory } from "@/domain/pipeline";
import { getTriageInbox } from "@/domain/requests";
import { getComplianceVault } from "@/domain/vault";
import { pendingFindings } from "@/domain/dvi";
import { recentJobs } from "@/domain/bridge";
import { licenceLabel } from "@/domain/compliance";
import { formatAud, formatShortDay } from "@/domain/format";
import { payToSavingCents, workshopFeeCents } from "@/domain/payments";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LicenceTag } from "@/components/ui/LicenceTag";
import { PdfBridge } from "./PdfBridge";
import { PipelineView, type PipelineRow } from "./PipelineView";
import { TriageInbox } from "./TriageInbox";
import { ComplianceVault } from "./ComplianceVault";
import { DviQueue } from "./DviQueue";
import { SettingsPanel } from "./SettingsPanel";

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "bridge", label: "PDF Bridge", icon: "upload" },
  { id: "pipeline", label: "Rainy-day pipeline", icon: "signal" },
  { id: "inbox", label: "Triage inbox", icon: "inbox" },
  { id: "dvi", label: "Bay DVI review", icon: "mic" },
  { id: "vault", label: "Compliance vault", icon: "vault" },
  { id: "settings", label: "Payments & setup", icon: "settings" },
];

export async function CounterScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as string) : "bridge";
  const ctx = await appContext();
  const [pipeline, inbox, pending, vault, jobs, history] = await Promise.all([
    getRainyDayPipeline(ctx),
    getTriageInbox(ctx),
    pendingFindings(ctx),
    getComplianceVault(ctx),
    recentJobs(ctx),
    campaignHistory(ctx),
  ]);
  const newRequests = inbox.bookings.filter((b) => b.booking.status === "REQUESTED").length + inbox.mods.filter((m) => m.request.status === "NEW").length + inbox.quoteRequests.length;
  const counts: Record<string, number | null> = { bridge: null, pipeline: pipeline.totals.count, inbox: newRequests, dvi: pending.length, vault: null, settings: null };
  const quietDay = defaultQuietDay();
  const plan = planQuietBay(pipeline.items, 7.5);
  const advisor = "Kirsty";
  const rows: PipelineRow[] = pipeline.items.map((i) => ({
    findingId: i.finding.id,
    vehicleId: i.vehicle.id,
    title: i.finding.title,
    severity: i.finding.severity,
    status: i.finding.status,
    category: i.finding.category,
    low: i.finding.estimateLowCents ?? 0,
    high: i.finding.estimateHighCents ?? 0,
    valueCents: i.valueCents,
    ageDays: i.ageDays,
    hours: i.hours,
    score: i.score,
    rego: i.vehicle.rego,
    regoState: i.vehicle.regoState,
    vehicle: `${i.vehicle.year} ${i.vehicle.make} ${i.vehicle.model}`,
    customer: i.customer ? `${i.customer.firstName} ${i.customer.lastName}` : "—",
    mobile: i.customer?.mobile ?? null,
    sms: campaignSms(ctx.workshop.name, advisor, i, quietDay),
    contacted: history.some((h) => h.findingId === i.finding.id),
  }));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-chalk bg-bench">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate">Front counter · Publish & recover</p>
            <h1 className="font-wide text-[19px] font-bold leading-tight">{ctx.workshop.name}</h1>
          </div>
          <LicenceTag label={licenceLabel(ctx.workshop)} tone="plain" />
          <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <dt className="text-[12px] font-semibold text-slate">Recoverable on the table</dt>
              <dd className="readout text-[22px] font-semibold leading-tight">{formatAud(pipeline.totals.recoverableCents, { whole: true })}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold text-slate">Needs a reply</dt>
              <dd className="readout text-[22px] font-semibold leading-tight">{newRequests}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold text-slate">Vault</dt>
              <dd className={`flex items-center gap-1 text-[14px] font-semibold ${vault.chain.ok ? "text-rag-green" : "text-rag-red"}`}>
                <Icon name="shield" size={16} /> {vault.chain.ok ? `${vault.chain.count} sealed` : "Chain broken"}
              </dd>
            </div>
          </dl>
        </div>
        <nav aria-label="Counter sections" className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-2 lg:px-4">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/counter?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-[3px] px-3 text-[14px] font-semibold ${tab === t.id ? "border-sump text-sump" : "border-transparent text-slate hover:text-sump"}`}
            >
              <Icon name={t.icon} size={17} />
              {t.label}
              {counts[t.id] ? <span className="readout rounded-sm bg-sump px-1.5 text-[11px] text-white">{counts[t.id]}</span> : null}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
        {tab === "bridge" ? (
          <PdfBridge
            recent={jobs.map((j) => ({ id: j.id, filename: j.filename, status: j.status, confidence: j.confidence, createdAt: j.createdAt.toISOString(), reviewSeconds: j.reviewSeconds }))}
            wms={ctx.workshop.wms}
            threshold={ctx.workshop.autoPublishThreshold}
          />
        ) : null}
        {tab === "pipeline" ? (
          <PipelineView
            rows={rows}
            plan={plan.map((p) => p.finding.id)}
            quietDay={quietDay}
            quietDayLabel={formatShortDay(quietDay)}
            totals={pipeline.totals}
            sentCount={history.length}
          />
        ) : null}
        {tab === "inbox" ? (
          <TriageInbox
            bookings={inbox.bookings.map((b) => ({
              id: b.booking.id,
              status: b.booking.status,
              serviceType: b.booking.serviceType,
              requestedDate: b.booking.requestedDate,
              dropOff: b.booking.dropOff,
              loanCar: b.booking.loanCar,
              notes: b.booking.notes,
              items: b.items,
              createdAt: b.booking.createdAt.toISOString(),
              vehicle: { id: b.vehicle.id, rego: b.vehicle.rego, regoState: b.vehicle.regoState, label: `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model} ${b.vehicle.variant}`, vin: b.vehicle.vin },
              customer: b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : "—",
            }))}
            mods={inbox.mods.map((m) => ({
              id: m.request.id,
              status: m.request.status,
              title: m.request.title,
              description: m.request.description,
              usage: m.request.usage,
              budgetBand: m.request.budgetBand,
              vin: m.request.vinSnapshot,
              variant: m.request.variantSnapshot,
              photos: m.request.photoKeys,
              productLink: m.request.productLink,
              createdAt: m.request.createdAt.toISOString(),
              vehicle: { id: m.vehicle.id, rego: m.vehicle.rego, regoState: m.vehicle.regoState },
              customer: m.customer ? `${m.customer.firstName} ${m.customer.lastName}` : "—",
            }))}
            quoteRequests={inbox.quoteRequests.map((q) => ({
              id: q.finding.id,
              title: q.finding.title,
              severity: q.finding.severity,
              low: q.finding.estimateLowCents,
              high: q.finding.estimateHighCents,
              vehicle: { id: q.vehicle.id, rego: q.vehicle.rego, regoState: q.vehicle.regoState, label: `${q.vehicle.year} ${q.vehicle.make} ${q.vehicle.model}` },
              updatedAt: q.finding.updatedAt.toISOString(),
            }))}
          />
        ) : null}
        {tab === "dvi" ? (
          <DviQueue
            items={pending.map((p) => ({
              id: p.finding.id,
              title: p.finding.title,
              severity: p.finding.severity,
              explanation: p.finding.customerExplanation,
              transcript: p.finding.technicianNote,
              measurement: p.finding.measurement,
              horizon: p.finding.horizonText,
              low: p.finding.estimateLowCents,
              high: p.finding.estimateHighCents,
              diagram: p.finding.diagram,
              annotation: p.finding.annotation,
              createdAt: p.finding.createdAt.toISOString(),
              vehicle: { id: p.vehicle.id, rego: p.vehicle.rego, regoState: p.vehicle.regoState, label: `${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model}` },
            }))}
          />
        ) : null}
        {tab === "vault" ? (
          <ComplianceVault
            chain={vault.chain}
            rows={vault.rows.map(({ event: e, vehicle: v }) => ({
              id: e.id,
              seq: e.seq,
              eventType: e.eventType,
              actorRole: e.actorRole,
              signerName: e.signerName,
              signatureSvg: e.signatureSvg,
              acknowledgements: e.acknowledgements,
              payload: e.payload,
              prevHash: e.prevHash,
              contentHash: e.contentHash,
              occurredAt: e.occurredAt.toISOString(),
              vehicle: v ? { rego: v.rego, regoState: v.regoState, label: `${v.make} ${v.model}` } : null,
            }))}
          />
        ) : null}
        {tab === "settings" ? (
          <SettingsPanel
            settings={{ bnplEnabled: ctx.workshop.bnplEnabled, bnplMinCents: ctx.workshop.bnplMinCents, paytoEnabled: ctx.workshop.paytoEnabled, cardEnabled: ctx.workshop.cardEnabled }}
            examples={[46800, 120000, 330000].map((a) => ({
              amount: a,
              payto: workshopFeeCents("PAYTO", a),
              card: workshopFeeCents("CARD", a),
              afterpay: workshopFeeCents("BNPL_AFTERPAY", a),
              saving: payToSavingCents(a),
            }))}
          />
        ) : null}
      </main>
    </div>
  );
}
