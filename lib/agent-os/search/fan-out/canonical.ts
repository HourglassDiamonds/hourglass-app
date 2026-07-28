/**
 * Canonical-source helpers — group FAQ fragments, approach Q&A, and transcripts
 * under one underlying page/source so scoring does not treat derivatives as
 * independent authority.
 */

import type { FanOutContentRecord } from "./types";

/** Strip hash/query; normalize trailing slash. */
export function canonicalSourceIdFromUrl(url: string): string {
  const bare = url.split("#")[0]?.split("?")[0] ?? url;
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

export function uniqueCanonicalSourceIds(
  records: FanOutContentRecord[],
): string[] {
  return [...new Set(records.map((r) => r.canonicalSourceId))];
}

export type CanonicalInventoryStats = {
  totalNormalizedRecords: number;
  uniqueCanonicalAssets: number;
  derivativeRecordCount: number;
  topCrowdedSources: Array<{ canonicalSourceId: string; recordCount: number }>;
};

export function summarizeCanonicalInventory(
  records: FanOutContentRecord[],
): CanonicalInventoryStats {
  const counts = new Map<string, number>();
  for (const r of records) {
    counts.set(r.canonicalSourceId, (counts.get(r.canonicalSourceId) ?? 0) + 1);
  }
  const uniqueCanonicalAssets = counts.size;
  const derivativeRecordCount = records.length - uniqueCanonicalAssets;
  const topCrowdedSources = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([canonicalSourceId, recordCount]) => ({
      canonicalSourceId,
      recordCount,
    }));
  return {
    totalNormalizedRecords: records.length,
    uniqueCanonicalAssets,
    derivativeRecordCount,
    topCrowdedSources,
  };
}
