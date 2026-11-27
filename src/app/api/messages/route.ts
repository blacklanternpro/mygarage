import { messageSchema, postMessage } from "@/domain/requests";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request) {
  return run(async () => postMessage(await appContext(), await readJson(req, messageSchema)));
}
