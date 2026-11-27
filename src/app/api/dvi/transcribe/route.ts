import { z } from "zod";
import { structureDictation } from "@/domain/dvi";
import { appContext, readJson, run } from "@/lib/server";

const schema = z.object({ clipId: z.string().optional(), transcript: z.string().trim().min(3).max(2000).optional() });

/** STT (mock Deepgram Nova-3) → deterministic jargon-to-plain-English structuring. */
export async function POST(req: Request) {
  return run(async () => {
    const ctx = await appContext();
    const input = await readJson(req, schema);
    const stt = input.transcript
      ? { transcript: input.transcript, confidence: 1, durationSec: 0, model: "typed" as const, words: input.transcript.split(/\s+/).length }
      : await ctx.adapters.stt.transcribe({ clipId: input.clipId });
    return { stt, draft: structureDictation(stt.transcript) };
  });
}
