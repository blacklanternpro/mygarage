import { campaignSchema, launchFillBayCampaign } from "@/domain/pipeline";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request) {
  return run(async () => launchFillBayCampaign(await appContext(), await readJson(req, campaignSchema)));
}
