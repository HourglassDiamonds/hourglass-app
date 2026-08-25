import { createHash } from "node:crypto";

/** Deterministic UUID-shaped id from a stable key. Not a random UUID. */
export function stableAttentionId(seed: string): string {
  const hex = createHash("sha1").update(`continuum-cos:${seed}`).digest("hex");
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

export function briefIdForLocalDate(localDate: string): string {
  return stableAttentionId(`brief:${localDate}`);
}
