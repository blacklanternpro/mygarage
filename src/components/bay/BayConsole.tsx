"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Severity } from "@/db/schema";
import type { FindingDraft } from "@/domain/dvi";
import type { SttResult } from "@/adapters/contracts";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { InspectionDiagram } from "@/components/diagrams/InspectionDiagram";
import { CATEGORY_LABELS, DIAGRAM_FOR_CATEGORY } from "@/domain/categories";
import { formatKm } from "@/domain/format";

interface Job {
  id: string;
  rego: string;
  regoState: string;
  label: string;
  variant: string;
  odometerKm: number;
}

const SEV: { id: Severity; label: string; bg: string; fg: string; sub: string }[] = [
  { id: "URGENT_RED", label: "RED", sub: "Urgent / safety", bg: "bg-rag-red", fg: "text-white" },
  { id: "WATCH_AMBER", label: "AMBER", sub: "Watch / upcoming", bg: "bg-rag-amber", fg: "text-black" },
  { id: "HEALTHY_GREEN", label: "GREEN", sub: "Checked OK", bg: "bg-rag-green", fg: "text-white" },
];

export function BayConsole({ jobs, selectedId, clips, technicians, recent }: { jobs: Job[]; selectedId: string; clips: { id: string; label: string; durationSec: number }[]; technicians: string[]; recent: { id: string; title: string; severity: Severity; reviewStatus: string; createdAt: string }[] }) {
  const job = jobs.find((j) => j.id === selectedId) ?? jobs[0];
  const [tech, setTech] = useState(technicians[0]);
  const [clip, setClip] = useState(clips[0]?.id);
  const [recording, setRecording] = useState(false);
  const [heldFor, setHeldFor] = useState(0);
  const holdStart = useRef(0);
  const [stt, setStt] = useState<SttResult | null>(null);
  const [draft, setDraft] = useState<FindingDraft | null>(null);
  const [typed, setTyped] = useState("");
  const [marks, setMarks] = useState<{ x: number; y: number; label: string }[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const transcribe = useAction<{ stt: SttResult; draft: FindingDraft }>();
  const save = useAction<{ id: string; title: string }>();

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setHeldFor((Date.now() - holdStart.current) / 1000), 100);
    return () => clearInterval(t);
  }, [recording]);

  const begin = () => {
    if (recording || transcribe.pending) return;
    holdStart.current = Date.now();
    setHeldFor(0);
    setRecording(true);
    setSaved(null);
  };
  const end = async () => {
    if (!recording) return;
    setRecording(false);
    const r = await transcribe.call("/api/dvi/transcribe", { clipId: clip }, { refresh: false });
    if (r) {
      setStt(r.stt);
      setDraft(r.draft);
      setMarks([]);
    }
  };
  const fromTyped = async () => {
    if (typed.trim().length < 3) return;
    const r = await transcribe.call("/api/dvi/transcribe", { transcript: typed }, { refresh: false });
    if (r) {
      setStt(r.stt);
      setDraft(r.draft);
      setMarks([]);
      setSaved(null);
    }
  };
  const update = (patch: Partial<FindingDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const dollars = (c: number | null) => (c == null ? "" : String(Math.round(c / 100)));

  return (
    <div className="min-h-dvh bg-white text-black">
      <header className="border-b-[3px] border-black">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="sun" size={22} />
            <span className="text-[13px] font-bold">Bay mode · high contrast</span>
          </div>
          <label className="ml-auto flex items-center gap-2 text-[15px] font-bold">
            Technician
            <select className="h-12 rounded-md border-[3px] border-black bg-white px-2 text-[16px] font-bold" value={tech} onChange={(e) => setTech(e.target.value)}>
              {technicians.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Vehicles on the hoist today" className="mx-auto flex max-w-[1200px] gap-2 overflow-x-auto px-4 pb-3">
          {jobs.map((j) => (
            <Link
              key={j.id}
              href={`/bay?v=${j.id}`}
              scroll={false}
              aria-current={j.id === job?.id ? "true" : undefined}
              onClick={() => {
                setDraft(null);
                setStt(null);
                setSaved(null);
              }}
              className={`flex min-h-16 shrink-0 flex-col justify-center rounded-md border-[3px] px-3 ${j.id === job?.id ? "border-black bg-black text-white" : "border-black bg-white"}`}
            >
              <span className="readout text-[18px] font-bold">{j.rego}</span>
              <span className="text-[13px] font-semibold">{j.label}</span>
            </Link>
          ))}
        </nav>
      </header>

      {job ? (
        <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="dictate-h">
            <h1 id="dictate-h" className="text-[26px] font-extrabold leading-tight">
              {job.label}
            </h1>
            <p className="text-[16px] font-semibold">
              {job.variant} · <span className="readout">{formatKm(job.odometerKm)}</span>
            </p>

            <button
              type="button"
              aria-label="Hold to dictate a finding. Release to transcribe."
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as Element).setPointerCapture?.(e.pointerId);
                begin();
              }}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  begin();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  end();
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`mt-5 flex min-h-[148px] w-full touch-none select-none flex-col items-center justify-center gap-2 rounded-xl border-[3px] border-black text-[24px] font-extrabold ${recording ? "recording-pulse bg-rag-red text-white" : "bg-black text-white"}`}
            >
              <Icon name="mic" size={40} strokeWidth={2.5} />
              {recording ? (
                <span className="flex items-center gap-3">
                  Listening… <span className="readout text-[20px]">{heldFor.toFixed(1)} s</span>
                </span>
              ) : transcribe.pending ? (
                "Transcribing…"
              ) : (
                "Hold to dictate finding"
              )}
              {recording ? (
                <span className="flex h-6 items-end gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} className="w-1.5 animate-pulse rounded bg-white" style={{ height: `${8 + ((i * 7) % 16)}px`, animationDelay: `${i * 90}ms` }} />
                  ))}
                </span>
              ) : null}
            </button>
            <p className="mt-2 text-[14px] font-semibold">Thumb down, talk like you would to the advisor, let go. Works with gloves: no small buttons.</p>

            <fieldset className="mt-4">
              <legend className="text-[15px] font-bold">Pre-loaded clip for this hold (Stage 1 simulator)</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {clips.map((c) => (
                  <label key={c.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-[3px] px-3 ${clip === c.id ? "border-black bg-black text-white" : "border-black/30"}`}>
                    <input type="radio" name="clip" className="h-6 w-6 accent-black" checked={clip === c.id} onChange={() => setClip(c.id)} />
                    <span className="text-[15px] font-bold">{c.label}</span>
                    <span className="readout ml-auto text-[13px]">{c.durationSec}s</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <details className="mt-4 rounded-md border-[3px] border-black/30 px-3 py-2">
              <summary className="cursor-pointer py-2 text-[15px] font-bold">Type it instead</summary>
              <textarea className="mt-1 w-full rounded-md border-[3px] border-black p-2 text-[16px]" rows={3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. Rear tyres at 3 mil, do them within a month, 380 to 460" />
              <button type="button" className="mt-2 h-14 w-full rounded-md border-[3px] border-black bg-white text-[16px] font-bold" onClick={fromTyped} disabled={transcribe.pending}>
                Turn into a finding
              </button>
            </details>
            {transcribe.error ? <p className="mt-2 font-bold text-rag-red">{transcribe.error.message}</p> : null}

            <section className="mt-6" aria-labelledby="recent-h">
              <h2 id="recent-h" className="text-[17px] font-bold">
                Dictated on this vehicle
              </h2>
              <ul className="mt-2 space-y-2">
                {recent.length ? (
                  recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-md border-2 border-black/30 px-3 py-2 text-[15px] font-semibold">
                      <span className={`h-4 w-4 rounded-sm ${r.severity === "URGENT_RED" ? "bg-rag-red" : r.severity === "WATCH_AMBER" ? "bg-rag-amber" : "bg-rag-green"}`} aria-hidden="true" />
                      {r.title}
                      <span className="ml-auto text-[13px]">{r.reviewStatus === "PENDING_REVIEW" ? "With advisor" : "Published"}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[15px]">Nothing yet.</li>
                )}
              </ul>
            </section>
          </section>

          <section aria-labelledby="draft-h" className="min-w-0">
            <h2 id="draft-h" className="text-[22px] font-extrabold">
              Finding for the customer
            </h2>
            {saved ? (
              <p role="status" className="mt-3 rounded-md border-[3px] border-rag-green bg-rag-green-wash px-3 py-3 text-[17px] font-bold">
                Saved: “{saved}”. It’s waiting for the advisor at the front counter.
              </p>
            ) : null}
            {!draft ? (
              <div className="mt-3 rounded-xl border-[3px] border-dashed border-black/40 px-4 py-12 text-center text-[17px] font-semibold">Hold the button and describe what you see. The plain-English version appears here for you to check.</div>
            ) : (
              <div className="mt-3 space-y-4">
                {stt ? (
                  <div className="rounded-md bg-black px-3 py-2 text-white">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-white/70">
                      Heard ({stt.model}, {Math.round(stt.confidence * 100)}%)
                    </p>
                    <p className="text-[16px]">“{stt.transcript}”</p>
                  </div>
                ) : null}
                <div role="group" aria-label="Severity" className="grid grid-cols-3 gap-2">
                  {SEV.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={draft.severity === s.id}
                      onClick={() => update({ severity: s.id })}
                      className={`flex min-h-16 flex-col items-center justify-center rounded-md border-[3px] text-[18px] font-extrabold ${draft.severity === s.id ? `${s.bg} ${s.fg} border-black` : "border-black/30 bg-white text-black"}`}
                    >
                      {s.label}
                      <span className="text-[12px] font-bold">{s.sub}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[15px] font-bold" htmlFor="d-title">
                    Title
                  </label>
                  <input id="d-title" className="mt-1 h-14 w-full rounded-md border-[3px] border-black px-3 text-[17px] font-semibold" value={draft.title} onChange={(e) => update({ title: e.target.value })} />
                </div>
                <div>
                  <label className="text-[15px] font-bold" htmlFor="d-expl">
                    What the customer reads
                  </label>
                  <textarea id="d-expl" className="mt-1 w-full rounded-md border-[3px] border-black p-3 text-[16px] leading-snug" rows={4} value={draft.customerExplanation} onChange={(e) => update({ customerExplanation: e.target.value })} />
                  {draft.jargon.length ? (
                    <ul className="mt-1 space-y-0.5 text-[13px] font-semibold">
                      {draft.jargon.map((j) => (
                        <li key={j.heard}>
                          “{j.heard}” → {j.plain}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[15px] font-bold" htmlFor="d-hz">
                      When
                    </label>
                    <input id="d-hz" className="mt-1 h-14 w-full rounded-md border-[3px] border-black px-3 text-[16px]" value={draft.horizonText ?? ""} onChange={(e) => update({ horizonText: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="text-[15px] font-bold" htmlFor="d-m">
                      Measurement
                    </label>
                    <input id="d-m" className="mt-1 h-14 w-full rounded-md border-[3px] border-black px-3 text-[16px]" value={draft.measurement ?? ""} onChange={(e) => update({ measurement: e.target.value || null })} />
                  </div>
                </div>
                {draft.severity !== "HEALTHY_GREEN" ? (
                  <fieldset>
                    <legend className="text-[15px] font-bold">Indicative estimate, inc. GST (non-binding)</legend>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[18px] font-bold">A$</span>
                      <input aria-label="Low estimate in dollars" inputMode="numeric" className="readout h-14 w-full rounded-md border-[3px] border-black px-3 text-[18px]" value={dollars(draft.estimateLowCents)} onChange={(e) => update({ estimateLowCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} />
                      <span className="text-[18px] font-bold">to</span>
                      <input aria-label="High estimate in dollars" inputMode="numeric" className="readout h-14 w-full rounded-md border-[3px] border-black px-3 text-[18px]" value={dollars(draft.estimateHighCents)} onChange={(e) => update({ estimateHighCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} />
                    </div>
                  </fieldset>
                ) : null}
                <div>
                  <p className="text-[15px] font-bold">Photo markup: tap to circle the problem ({marks.length}/3)</p>
                  <div
                    className="relative mt-1 cursor-crosshair"
                    onClick={(e) => {
                      if (marks.length >= 3) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setMarks((m) => [...m, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, label: draft.component }]);
                    }}
                  >
                    <InspectionDiagram kind={draft.diagram ?? DIAGRAM_FOR_CATEGORY[draft.category] ?? null} severity={draft.severity} measurement={draft.measurement} title={draft.title} annotations={marks} />
                  </div>
                  {marks.length ? (
                    <button type="button" className="mt-2 h-12 rounded-md border-[3px] border-black px-4 text-[15px] font-bold" onClick={() => setMarks([])}>
                      Clear marks
                    </button>
                  ) : null}
                  <p className="mt-1 text-[13px] font-semibold">Category: {CATEGORY_LABELS[draft.category] ?? draft.category}. Stage 2 attaches the real photo or 15-second clip from the camera.</p>
                </div>
                {save.error ? <p className="font-bold text-rag-red">{save.error.message}</p> : null}
                <button
                  type="button"
                  className="h-20 w-full rounded-xl border-[3px] border-black bg-black text-[20px] font-extrabold text-white disabled:opacity-50"
                  disabled={save.pending}
                  onClick={async () => {
                    const r = await save.call("/api/dvi/findings", {
                      vehicleId: job.id,
                      technicianName: tech,
                      transcript: draft.transcript,
                      severity: draft.severity,
                      title: draft.title,
                      customerExplanation: draft.customerExplanation,
                      category: draft.category,
                      measurement: draft.measurement,
                      horizonText: draft.horizonText,
                      estimateLowCents: draft.estimateLowCents,
                      estimateHighCents: draft.estimateHighCents,
                      annotation: marks.map((m) => ({ ...m, label: m.label.slice(0, 40) })),
                    });
                    if (r) {
                      setSaved(r.title);
                      setDraft(null);
                      setStt(null);
                      setMarks([]);
                    }
                  }}
                >
                  {save.pending ? "Saving…" : "Save for advisor review"}
                </button>
              </div>
            )}
            <p className="mt-4 text-[14px] font-semibold">
              Reviewed at the <Link className="underline" href="/counter?tab=dvi">front counter</Link> before the customer sees it.
            </p>
          </section>
        </main>
      ) : (
        <p className="p-6 text-[18px]">No vehicles on the hoist.</p>
      )}
    </div>
  );
}
