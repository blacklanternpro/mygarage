import { and, desc, eq, inArray } from "drizzle-orm";
import { findings, vehicles } from "@/db/schema";
import { scoped } from "@/db/tenant";
import { id } from "@/db/seed-data";
import { appContext } from "@/lib/server";
import { STAFF } from "@/db/seed-data";
import { BayConsole } from "./BayConsole";

/** Today's jobs on the hoist (Stage 1: fixed list from the demo world). */
const TODAYS_JOBS = ["vehicle:hilux", "vehicle:cx5", "vehicle:ranger", "vehicle:kelly-triton", "vehicle:fraser-forester"].map(id);

export async function BayScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await appContext();
  const rows = await ctx.db.select().from(vehicles).where(scoped(vehicles, ctx.workshop.id, inArray(vehicles.id, TODAYS_JOBS)));
  const jobs = TODAYS_JOBS.map((vid) => rows.find((r) => r.id === vid)).filter((v): v is NonNullable<typeof v> => !!v);
  const selected = jobs.find((j) => j.id === sp.v) ?? jobs[0];
  const recent = selected
    ? await ctx.db
        .select()
        .from(findings)
        .where(and(eq(findings.workshopId, ctx.workshop.id), eq(findings.vehicleId, selected.id), eq(findings.source, "VOICE_DVI")))
        .orderBy(desc(findings.createdAt))
        .limit(6)
    : [];
  return (
    <BayConsole
      jobs={jobs.map((j) => ({ id: j.id, rego: j.rego, regoState: j.regoState, label: `${j.year} ${j.make} ${j.model}`, variant: j.variant, odometerKm: j.odometerKm }))}
      selectedId={selected?.id ?? ""}
      clips={ctx.adapters.stt.clips()}
      technicians={STAFF.techs}
      recent={recent.map((f) => ({ id: f.id, title: f.title, severity: f.severity, reviewStatus: f.reviewStatus, createdAt: f.createdAt.toISOString() }))}
    />
  );
}
