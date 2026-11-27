import { bookingSchema, createBooking } from "@/domain/requests";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request) {
  return run(async () => createBooking(await appContext(), await readJson(req, bookingSchema)));
}
