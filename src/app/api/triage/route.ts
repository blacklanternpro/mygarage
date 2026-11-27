import { triageAction, triageSchema } from "@/domain/requests";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request) {
  return run(async () => triageAction(await appContext(), await readJson(req, triageSchema)));
}
