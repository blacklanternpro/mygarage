import { saveDraftSchema, saveVoiceFinding } from "@/domain/dvi";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request) {
  return run(async () => saveVoiceFinding(await appContext(), await readJson(req, saveDraftSchema)));
}
