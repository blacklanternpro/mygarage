import type { DbLike } from "@/db/client";
import type { Workshop } from "@/db/schema";
import type { Adapters } from "@/adapters/contracts";

/** Everything a domain service needs: tenant-scoped DB access, the workshop and its adapters. */
export interface Svc {
  db: DbLike;
  workshop: Workshop;
  adapters: Adapters;
}
