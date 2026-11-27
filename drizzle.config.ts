import { defineConfig } from "drizzle-kit";

// Stage 1 generates SQL migrations for PGlite. Stage 2 points the same schema at
// AWS Sydney (ap-southeast-2) Postgres via DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
});
