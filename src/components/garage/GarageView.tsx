"use client";
import Link from "next/link";
import { useState } from "react";
import { Rego } from "@/components/ui/Rego";
import { LicenceTag } from "@/components/ui/LicenceTag";
import { HealthDot, StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { formatDate, formatKm, relativeDays } from "@/domain/format";
import { WalletPassPreview } from "@/components/wallet/WalletPass";
import { FindingTag } from "./FindingTag";
import { ServiceTimeline } from "./ServiceTimeline";
import { MessageThread } from "./MessageThread";
import { ModThreads } from "./ModThreads";
import { GarageSheets } from "./sheets/GarageSheets";
import type { GarageData, SheetState } from "./types";

export function GarageView({ data }: { data: GarageData }) {
  const { workshop, detail, cards } = data;
  const v = detail.card.vehicle;
  const [sheet, setSheet] = useState<SheetState>(null);
  const [greenOpen, setGreenOpen] = useState(false);
  const quoteAction = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const driver = detail.driver;
  const signer = driver ? `${driver.firstName} ${driver.lastName}` : data.people[0] ? `${data.people[0].firstName} ${data.people[0].lastName}` : "";
  const requestQuote = async (findingId: string) => {
    setBusyId(findingId);
    await quoteAction.call(`/api/findings/${findingId}/request-quote`);
    setBusyId(null);
  };
  const t = detail.card.trigger;
  const svcDays = detail.card.nextServiceDays;
  const openWatch = detail.red.length + detail.amber.length;

  return (
    <div className="pb-24 lg:pb-10">
      {/* Shop band */}
      <header className="text-white" style={{ background: workshop.brandPrimary }}>
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 lg:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-wide text-[17px] font-bold leading-tight">{workshop.name}</p>
            <p className="text-[13px] text-white/75">
              {workshop.suburb} {workshop.state}
            </p>
          </div>
          <LicenceTag label={data.licence} tone="light" />
          <a href={`tel:${workshop.phone.replace(/\D/g, "")}`} className="inline-flex h-11 items-center gap-1.5 rounded-md border border-white/35 px-3 text-[14px] font-semibold hover:bg-white/10">
            <Icon name="phone" size={17} /> Call
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[292px_minmax(0,1fr)_360px] lg:gap-6 lg:px-6 lg:pt-6">
        {/* Vehicles */}
        <aside aria-label="Vehicles in your garage" className="lg:sticky lg:top-14 lg:self-start">
          <div className="px-4 pt-5 lg:px-0 lg:pt-0">
            <h1 className="text-[22px] font-bold leading-tight">Your garage</h1>
            <p className="text-[14px] text-slate">
              {data.householdName} · {data.people.map((p) => p.firstName).join(" & ")}
            </p>
          </div>
          <nav className="relative mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 lg:flex-col lg:overflow-visible lg:px-0">
            {cards.map((c) => {
              const active = c.vehicle.id === v.id;
              return (
                <Link
                  key={c.vehicle.id}
                  href={`/?v=${c.vehicle.id}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`relative snap-start rounded-md border-[1.5px] px-3 py-2.5 transition-colors lg:w-full ${active ? "border-sump bg-bench" : "border-transparent bg-bench/60 hover:border-chalk"} min-w-[228px]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Rego rego={c.vehicle.rego} state={c.vehicle.regoState} size="sm" />
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
                      <HealthDot severity={c.health} />
                      {c.red ? `${c.red} urgent` : c.amber ? `${c.amber} to watch` : "All healthy"}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] font-bold leading-tight">
                    {c.vehicle.year} {c.vehicle.make} {c.vehicle.model}
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 text-[12px] text-slate">
                    <div>
                      <dt className="sr-only">Odometer</dt>
                      <dd className="readout">{formatKm(c.vehicle.odometerKm)}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Rego expiry</dt>
                      <dd className={c.regoExpiryDays <= 45 ? "font-semibold text-sump" : ""}>Rego {relativeDays(c.regoExpiryDays)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="sr-only">Next service</dt>
                      <dd>Service {c.nextServiceDays != null ? relativeDays(c.nextServiceDays) : "not set"}</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </nav>
          <div className="hidden lg:mt-4 lg:block">
            <button type="button" className="w-full text-left" onClick={() => setSheet({ kind: "wallet" })} aria-label="Open your digital service sticker">
              {data.pass ? <WalletPassPreview pass={data.pass} version={data.passVersion} compact /> : null}
            </button>
          </div>
        </aside>

        {/* Health roadmap */}
        <main className="min-w-0 px-4 lg:px-0">
          <section aria-labelledby="vehicle-h" className="mt-4 lg:mt-0">
            <p className="text-[14px] font-semibold text-slate">
              {v.year} {v.make} · {v.variant}
            </p>
            <h2 id="vehicle-h" className="font-tailgate mt-1 break-words text-[44px] sm:text-[58px]">
              {v.model}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Rego rego={v.rego} state={v.regoState} size="lg" />
              <StatusBadge severity={detail.card.health} size="lg" label={detail.card.health === "HEALTHY_GREEN" ? "All healthy" : detail.card.red ? `${detail.card.red} urgent` : `${detail.card.amber} to watch`} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-chalk bg-chalk sm:grid-cols-3">
              <div className="bg-bench px-3 py-2.5">
                <dt className="text-[12px] font-semibold text-slate">Odometer</dt>
                <dd className="readout text-[17px] font-semibold">{formatKm(v.odometerKm)}</dd>
                <dd className="text-[12px] text-slate">recorded {formatDate(v.odometerAt)}</dd>
              </div>
              <div className="bg-bench px-3 py-2.5">
                <dt className="text-[12px] font-semibold text-slate">Next service</dt>
                <dd className="readout text-[17px] font-semibold">{v.nextServiceDueDate ? formatDate(v.nextServiceDueDate) : "—"}</dd>
                <dd className="text-[12px] text-slate">
                  {v.nextServiceDueKm ? `or ${formatKm(v.nextServiceDueKm)}` : ""}
                  {svcDays != null ? ` · ${relativeDays(svcDays)}` : ""}
                </dd>
              </div>
              <div className="col-span-2 bg-bench px-3 py-2.5 sm:col-span-1">
                <dt className="text-[12px] font-semibold text-slate">{v.regoState} rego expires</dt>
                <dd className="readout text-[17px] font-semibold">{formatDate(v.regoExpiry)}</dd>
                <dd className={`text-[12px] ${detail.card.regoExpiryDays <= 45 ? "font-semibold text-sump" : "text-slate"}`}>{relativeDays(detail.card.regoExpiryDays)}</dd>
              </div>
            </dl>
            {t.first?.by === "KM" && t.kmProjectedDate ? (
              <p className="mt-2 text-[13px] text-slate">At your usual {Math.round(v.avgKmPerDay)} km a day you'll hit {formatKm(t.kmDue ?? 0)} around {formatDate(t.kmProjectedDate)}, before the date. We'll remind you whichever comes first.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
              <button type="button" className="btn btn-primary" onClick={() => setSheet({ kind: "wallet" })}>
                <Icon name="wallet" size={18} /> Digital service sticker
              </button>
            </div>
          </section>

          <ErrorBanner error={quoteAction.error} />

          <section aria-labelledby="roadmap-h" className="mt-7">
            <div className="rule-heavy flex items-baseline justify-between pt-2">
              <h2 id="roadmap-h" className="text-[19px] font-bold">
                Health roadmap
              </h2>
              <span className="text-[13px] text-slate">
                Inspected {detail.latestInspection ? formatDate(detail.latestInspection.inspectedAt) : "—"}
                {detail.latestInspection ? ` by ${detail.latestInspection.technicianName}` : ""}
              </span>
            </div>

            {detail.red.length ? (
              <div className="mt-4">
                <h3 className="mb-2 text-[15px] font-bold text-rag-red">Urgent: needs attention now</h3>
                <div className="space-y-3">
                  {detail.red.map((f) => (
                    <FindingTag key={f.id} finding={f} licence={data.licence} paid={!!f.quote && data.paidQuoteIds.includes(f.quote.id)} open={setSheet} requestQuote={requestQuote} busyId={busyId} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="mb-2 text-[15px] font-bold">
                Ones to watch <span className="font-normal text-slate">· plan and budget ahead</span>
              </h3>
              {detail.amber.length ? (
                <div className="space-y-3">
                  {detail.amber.map((f) => (
                    <FindingTag key={f.id} finding={f} licence={data.licence} paid={!!f.quote && data.paidQuoteIds.includes(f.quote.id)} open={setSheet} requestQuote={requestQuote} busyId={busyId} />
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-chalk px-3 py-3 text-[14px] text-slate">Nothing to watch on this vehicle right now.</p>
              )}
            </div>

            <div className="mt-5 rounded-md border border-chalk bg-bench">
              <button type="button" className="flex min-h-12 w-full items-center gap-2 px-3 text-left" aria-expanded={greenOpen} onClick={() => setGreenOpen((o) => !o)}>
                <StatusBadge severity="HEALTHY_GREEN" />
                <span className="flex-1 text-[15px] font-bold">Checked &amp; healthy ({detail.green.length})</span>
                <Icon name="chevronDown" size={18} className={`transition-transform ${greenOpen ? "rotate-180" : ""}`} />
              </button>
              {greenOpen ? (
                <ul className="border-t border-chalk px-3 py-1">
                  {detail.green.map((g) => (
                    <li key={g.id} className="flex items-baseline justify-between gap-3 border-b border-chalk/60 py-2 last:border-0">
                      <span>
                        <span className="text-[14px] font-semibold">{g.title}</span>
                        <span className="block text-[13px] text-slate">{g.customerExplanation}</span>
                      </span>
                      {g.measurement ? <span className="readout shrink-0 text-[12.5px] text-slate">{g.measurement}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {detail.closed.length ? (
              <p className="mt-3 text-[13px] text-slate">
                Closed: {detail.closed.map((c) => `${c.title} (${c.status === "RESOLVED_ELSEWHERE" ? "resolved elsewhere" : "done"})`).join("; ")}
              </p>
            ) : null}
          </section>

          <ModThreads data={data} open={setSheet} signer={signer} />

          <section aria-labelledby="book-h" className="mt-8">
            <h2 id="book-h" className="rule-heavy pt-2 text-[19px] font-bold">
              Book or ask for a quote
            </h2>
            <p className="mt-1 text-[14px] text-slate">Request any time, day or night. Requests after hours are confirmed the next business morning.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" className="btn btn-primary h-14 justify-start px-4" onClick={() => setSheet({ kind: "book", findingIds: [] })}>
                <Icon name="calendar" /> Book a service or repair
              </button>
              <button type="button" className="btn btn-secondary h-14 justify-start px-4" onClick={() => setSheet({ kind: "mod" })}>
                <Icon name="wrench" /> Quote a 4x4 or modification job
              </button>
            </div>
          </section>
        </main>

        {/* History + messages */}
        <div className="min-w-0 px-4 lg:px-0">
          <ServiceTimeline records={detail.serviceRecords} vehicleId={v.id} licence={data.licence} />
          <MessageThread vehicleId={v.id} messages={detail.vehicleThread} authorName={signer} workshopName={workshop.name} />
        </div>
      </div>

      <footer className="mx-auto mt-10 max-w-[1280px] border-t border-chalk px-4 py-6 text-[13px] text-slate lg:px-6">
        <p className="font-semibold text-sump">{workshop.name}</p>
        <p>
          {workshop.addressLine}, {workshop.suburb} {workshop.state} {workshop.postcode}. {workshop.hoursText}.
        </p>
        <p className="mt-1">
          {data.licence}. Prices shown on your watch-list are non-binding estimates until you receive a Fixed Quote. Your data is held by {workshop.name} and hosted in Australia.
        </p>
        <p className="mt-2 text-[12px]">
          {openWatch} open item{openWatch === 1 ? "" : "s"} on this vehicle · Garage powered by MyGarage
        </p>
      </footer>

      {/* Thumb-reach action bar (phones) */}
      <nav aria-label="Quick actions" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-chalk bg-bench/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-[560px] grid-cols-3">
          <button type="button" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold" onClick={() => setSheet({ kind: "book", findingIds: [] })}>
            <Icon name="calendar" /> Book
          </button>
          <a href="#messages" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold">
            <Icon name="message" /> Messages
          </a>
          <button type="button" className="flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold" onClick={() => setSheet({ kind: "wallet" })}>
            <Icon name="wallet" /> Wallet
          </button>
        </div>
      </nav>

      <GarageSheets data={data} sheet={sheet} setSheet={setSheet} signer={signer} />
    </div>
  );
}
