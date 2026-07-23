/**
 * Fixture overlays for Local Authority / GBP intelligence demos.
 * Live mode must never consume these fixtures.
 */

import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import type { GbpDimensionKey } from "./types";

/** Optional single observed GBP dimension for fixture contract demos only. */
export const FIXTURE_GBP_OBSERVED_DIMENSIONS: Partial<
  Record<GbpDimensionKey, string>
> = {
  // Website URL is the safest demo observation — still not a verified adapter.
  "website-url": "https://www.hourglassdiamonds.com",
};

/**
 * Expand / replace GSC query rows for rich local-authority fixture coverage.
 * Callers must only apply in fixture mode.
 */
export function applyLocalAuthorityFixtureGscQueries(
  base: GscWeeklyBundle,
): GscWeeklyBundle {
  const localQueries = [
    {
      // 1. High-intent Charlotte query in positions 5–10
      query: "custom engagement rings charlotte",
      impressions: 480,
      clicks: 28,
      ctr: 0.058,
      position: 7.2,
    },
    {
      // 2. High-impression local query with weak CTR
      query: "engagement rings charlotte nc",
      impressions: 920,
      clicks: 16,
      ctr: 0.017,
      position: 18.4,
    },
    {
      // 3. Charlotte query that will mismatch generic pages (no charlotte path in top pages)
      query: "best jeweler fort mill sc",
      impressions: 410,
      clicks: 12,
      ctr: 0.029,
      position: 12.1,
    },
    {
      // 4. Strong branded location query resolving correctly
      query: "hourglass diamonds charlotte",
      impressions: 640,
      clicks: 96,
      ctr: 0.15,
      position: 2.1,
    },
    {
      // 11. Small-sample local query suppressed
      query: "waxhaw diamond appraisal",
      impressions: 42,
      clicks: 1,
      ctr: 0.024,
      position: 19.0,
    },
    {
      query: "south charlotte engagement rings",
      impressions: 310,
      clicks: 14,
      ctr: 0.045,
      position: 9.4,
    },
  ];

  const otherQueries = (base.current?.topQueries ?? []).filter(
    (q) => !/charlotte|waxhaw|fort mill|hourglass diamonds charlotte/i.test(q.query),
  );

  return {
    ...base,
    current: base.current
      ? {
          ...base.current,
          topQueries: [...localQueries, ...otherQueries],
          // Keep pages intentionally without Fort Mill / charlotte-specific paths
          // so mismatch detection can fire for fort mill query.
          topPages: base.current.topPages ?? [],
        }
      : undefined,
  };
}
