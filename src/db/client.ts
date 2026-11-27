/**
 * Database access. Stage 1: PGlite (embedded Postgres, WASM) persisted to .data/pglite.
 * Stage 2: swap `openDatabase` for drizzle-orm/node-postgres against AWS Sydney RDS — the schema,
 * migrations and every query stay the same.
 *
 * Initialisation is lazy (first `getDb()` call), never at import time, so `next build` never
 * opens the database.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbLike = DB | Tx;

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

export function dataDirPath(): string {
  return path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || ".data/pglite");
}

export function pidFilePath(): string {
  return path.join(path.dirname(dataDirPath()), "server.pid");
}

/** Open (and migrate) a database. No `dataDir` → in-memory (tests). */
export async function openDatabase(dataDir?: string): Promise<{ client: PGlite; db: DB }> {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.waitReady;
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { client, db };
}

interface Holder {
  promise: Promise<{ client: PGlite; db: DB }>;
}
const globalForDb = globalThis as unknown as { __mygarageDb?: Holder };

/** Process-wide singleton (survives Next dev hot reloads). Auto-seeds an empty database. */
export async function getDb(): Promise<DB> {
  if (!globalForDb.__mygarageDb) {
    const promise = (async () => {
      const opened = await openDatabase(dataDirPath());
      try {
        fs.writeFileSync(pidFilePath(), String(process.pid));
      } catch {
        /* non-fatal */
      }
      const { ensureSeeded } = await import("./seed");
      await ensureSeeded(opened.db);
      return opened;
    })();
    globalForDb.__mygarageDb = { promise };
    promise.catch(() => {
      globalForDb.__mygarageDb = undefined;
    });
  }
  return (await globalForDb.__mygarageDb.promise).db;
}
