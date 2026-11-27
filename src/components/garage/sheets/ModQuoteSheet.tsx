"use client";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import type { GarageData } from "../types";

const TYPES: [string, string][] = [
  ["SUSPENSION_LIFT", "Suspension lift"],
  ["BULLBAR_LIGHTS", "Bullbar & lighting"],
  ["WHEELS_TYRES", "Wheels & tyres"],
  ["DUAL_BATTERY", "Dual battery system"],
  ["TOWING", "Towbar & brake controller"],
  ["BRAKE_UPGRADE", "Brake upgrade"],
  ["EXHAUST", "Exhaust upgrade"],
  ["OTHER", "Something else"],
];
const BUDGETS = ["Under A$1,000", "A$1,000 – A$2,500", "A$2,500 – A$4,000", "A$4,000+", "Not sure yet"];

/** Downscale photos on the phone before upload (~1280px JPEG) — research §7 media budget. */
async function compress(file: File): Promise<{ contentType: "image/jpeg"; base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { contentType: "image/jpeg", base64: dataUrl.split(",")[1], preview: dataUrl };
}

export function ModQuoteSheet({ data, onClose }: { data: GarageData; onClose: () => void }) {
  const v = data.detail.card.vehicle;
  const [type, setType] = useState(TYPES[0][0]);
  const [desc, setDesc] = useState("");
  const [usage, setUsage] = useState("");
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [link, setLink] = useState("");
  const [photos, setPhotos] = useState<{ contentType: "image/jpeg"; base64: string; preview: string }[]>([]);
  const [done, setDone] = useState(false);
  const { call, pending, error } = useAction();
  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? "Quote request sent" : "Quote a modification"}
      subtitle={done ? undefined : `For your ${v.year} ${v.make} ${v.model}`}
      footer={
        done ? (
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={pending || desc.trim().length < 10}
            onClick={async () => {
              const r = await call("/api/mod-quotes", {
                vehicleId: v.id,
                modType: type,
                description: desc,
                usage: usage || undefined,
                budgetBand: budget,
                productLink: link || undefined,
                photos: photos.map(({ contentType, base64 }) => ({ contentType, base64 })),
              });
              if (r) setDone(true);
            }}
          >
            <Icon name="wrench" size={18} /> {pending ? "Sending…" : "Send quote request"}
          </button>
        )
      }
    >
      {done ? (
        <SuccessBanner>Sent straight to the advisor’s queue with your VIN and exact variant attached. Replies land in this vehicle’s messages.</SuccessBanner>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-chalk bg-white px-3 py-2 text-[13px]">
            <p className="font-semibold">Attached automatically</p>
            <p className="readout text-[12.5px]">VIN {v.vin}</p>
            <p className="text-slate">
              {v.year} {v.make} {v.model} {v.variant} · {v.engine}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="mod-type">
              Type of job
            </label>
            <select id="mod-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mod-desc">
              What are you after?
            </label>
            <textarea id="mod-desc" className="field" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Dual battery under the bonnet to run a fridge on weekend trips" />
          </div>
          <div>
            <label className="label" htmlFor="mod-usage">
              How do you use the vehicle? (optional)
            </label>
            <input id="mod-usage" className="field" value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="Daily commute, towing, beach driving…" />
          </div>
          <div>
            <label className="label" htmlFor="mod-budget">
              Rough budget
            </label>
            <select id="mod-budget" className="field" value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mod-link">
              Product link (optional)
            </label>
            <input id="mod-link" className="field" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </div>
          <div>
            <span className="label">Photos (optional, up to 4)</span>
            <label className="btn btn-secondary w-full cursor-pointer">
              <Icon name="camera" size={18} /> Add photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
                  const out: Awaited<ReturnType<typeof compress>>[] = [];
                  for (const f of files) out.push(await compress(f));
                  setPhotos((p) => [...p, ...out].slice(0, 4));
                  e.target.value = "";
                }}
              />
            </label>
            {photos.length ? (
              <ul className="mt-2 grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <li key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={`Photo ${i + 1} preview`} className="aspect-square w-full rounded-md object-cover" />
                    <button type="button" className="absolute -right-1.5 -top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sump text-white" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}>
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <ErrorBanner error={error} />
        </div>
      )}
    </Sheet>
  );
}
