import { appContext, errorResponse } from "@/lib/server";
import { notFound } from "@/domain/errors";

/** Serves Stage 1 media from the mock store. Stage 2: signed Cloudflare R2 URLs instead. */
export async function GET(req: Request) {
  try {
    const { adapters, workshop } = await appContext();
    const key = new URL(req.url).searchParams.get("key") ?? "";
    if (!key.startsWith(`r2://mygarage-syd/${workshop.id}/`)) throw notFound("Media");
    const obj = await adapters.media.get(key);
    if (!obj) throw notFound("Media");
    return new Response(Buffer.from(obj.bytes), { headers: { "content-type": obj.contentType, "cache-control": "private, max-age=300" } });
  } catch (e) {
    return errorResponse(e);
  }
}
