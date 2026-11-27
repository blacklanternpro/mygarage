import { getVehicleDetail } from "@/domain/garage";
import { appContext, run } from "@/lib/server";
import { notFound } from "@/domain/errors";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { db, workshop } = await appContext();
    const detail = await getVehicleDetail(db, workshop.id, (await ctx.params).id);
    if (!detail) throw notFound("Vehicle");
    return detail;
  });
}
