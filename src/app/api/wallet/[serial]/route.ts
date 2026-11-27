import { eq } from "drizzle-orm";
import { walletPasses } from "@/db/schema";
import { scoped } from "@/db/tenant";
import { appContext, errorResponse } from "@/lib/server";
import { notFound } from "@/domain/errors";

/** Mock "Add to Wallet": returns the unsigned pass.json (Apple) or generic object (Google). */
export async function GET(req: Request, ctx: { params: Promise<{ serial: string }> }) {
  try {
    const { db, workshop } = await appContext();
    const serial = decodeURIComponent((await ctx.params).serial);
    const [pass] = await db.select().from(walletPasses).where(scoped(walletPasses, workshop.id, eq(walletPasses.serialNumber, serial)));
    if (!pass) throw notFound("Wallet pass");
    const format = new URL(req.url).searchParams.get("format") === "google" ? "google" : "apple";
    const payload = pass.payload as { apple: unknown; google: unknown; signature: string };
    return Response.json(
      { format, version: pass.version, signature: payload.signature, note: "Stage 1 mock — Stage 2 signs a real .pkpass / Google Wallet JWT.", pass: format === "google" ? payload.google : payload.apple },
      { headers: { "content-disposition": `inline; filename="${serial}.${format === "google" ? "json" : "pass.json"}"` } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
