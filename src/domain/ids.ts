import { createHash } from "node:crypto";

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Deterministic UUID (v4 layout) derived from a stable key. Used for seed rows so demo URLs
 * survive a reset, and for mock adapter identifiers (no Math.random anywhere in mocks).
 */
export function stableId(key: string): string {
  const h = sha256(`mygarage:${key}`);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Short deterministic token, e.g. for mock provider references. */
export function shortHash(text: string, length = 10): string {
  return sha256(text).slice(0, length);
}

/** JSON with recursively sorted keys — the canonical form used for hashing. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
