/**
 * `npm run db:seed` — reset + seed the local PGlite database (idempotent).
 * PGlite is single-process: stop `npm run dev` first, or use the in-app "Reset demo" button.
 */
import fs from "node:fs";
import { dataDirPath, openDatabase, pidFilePath } from "@/db/client";
import { resetAndSeed } from "@/db/seed";
import { verifyAuditChain } from "@/domain/audit";
import { DEMO_WORKSHOP_ID } from "@/db/tenant";

function devServerRunning(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(pidFilePath(), "utf8"), 10);
    if (!pid || pid === process.pid) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function main() {
  const live = devServerRunning();
  if (live) {
    console.error(`A MyGarage server (pid ${live}) has the database open. Stop it first, or use Reset demo in the app (POST /api/demo/reset).`);
    process.exit(1);
  }
  const dir = dataDirPath();
  console.log(`Seeding PGlite at ${dir} …`);
  const { client, db } = await openDatabase(dir);
  const t = Date.now();
  await resetAndSeed(db);
  const chain = await verifyAuditChain(db, DEMO_WORKSHOP_ID);
  console.log(`Seeded in ${Date.now() - t} ms. Compliance vault: ${chain.count} events, chain ${chain.ok ? "verified" : "BROKEN"}.`);
  await client.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
