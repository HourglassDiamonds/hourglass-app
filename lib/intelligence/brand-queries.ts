/** Branded search query patterns for GSC brand-demand aggregation. */

export const BRAND_QUERY_PATTERNS = [
  "hourglass diamonds",
  "hourglass diamonds charlotte",
  "hourglass engagement rings",
  "hourglass diamond studio",
  "hourglass custom rings",
] as const;

export function isBrandQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (!q.includes("hourglass")) return false;
  return BRAND_QUERY_PATTERNS.some((pattern) => q.includes(pattern));
}
