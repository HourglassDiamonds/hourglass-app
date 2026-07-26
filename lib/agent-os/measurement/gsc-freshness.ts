/**
 * Google Search Console freshness — Pacific (America/Los_Angeles) source dates.
 *
 * Search Analytics startDate/endDate and metadata.first_incomplete_date are
 * Pacific calendar dates. Founder cadence may still use America/New_York for
 * briefing, but GSC source dates must not be labeled as ET.
 *
 * Zero-traffic days are omitted from date-dimension rows; absence of a row is
 * not evidence of missing/delayed source data.
 */

import {
  getAgentOsMeasurementWindows,
  shiftCalendarDays,
  type DateRange,
} from "./date-windows";
import type { MeasurementHealthCode } from "./health-codes";

/** Official Search Analytics source timezone. */
export const GSC_SOURCE_TIMEZONE = "America/Los_Angeles" as const;

/**
 * When metadata.first_incomplete_date is absent, assume this many days before
 * the most recent complete Pacific day are still incomplete (conservative).
 * newestFinalized = completePacificDay - FALLBACK_INCOMPLETE_LAG_DAYS.
 */
export const GSC_FALLBACK_INCOMPLETE_LAG_DAYS = 2;

export type GscDateActivityRow = {
  date: string;
  impressions: number;
  clicks: number;
};

export type GscFreshnessBoundary = {
  /** Newest Pacific calendar date that is finalized (safe for decision windows). */
  newestFinalizedDate: string | null;
  /** First Pacific date still being processed, when known. */
  firstIncompleteDate: string | null;
  /** Newest Pacific date with impressions+clicks > 0 (may be null or behind finalized). */
  newestObservedActivityDate: string | null;
  boundarySource: "metadata" | "conservative-fallback";
  sourceTimezone: typeof GSC_SOURCE_TIMEZONE;
  /** Age of newestFinalizedDate vs most recent complete Pacific day. */
  ageDays: number | null;
  lagClassification:
    | "fresh"
    | "normal-delay"
    | "elevated-delay"
    | "unusual-stale"
    | "unknown";
  healthCode: MeasurementHealthCode;
  confidenceMultiplier: number;
  /** Probe window used for the date discovery query. */
  probeRange: DateRange;
};

function parseIsoDate(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
}

/**
 * Derive newest finalized / incomplete / observed dates from one bounded
 * date-dimension response (dataState=all). Pure — no network.
 */
export function resolveGscFreshnessBoundary(input: {
  asOf?: Date;
  lookbackDays?: number;
  firstIncompleteDate?: string | null;
  rows: GscDateActivityRow[];
}): GscFreshnessBoundary {
  const asOf = input.asOf ?? new Date();
  const lookback = input.lookbackDays ?? 16;
  const pacific = getAgentOsMeasurementWindows(asOf, GSC_SOURCE_TIMEZONE);
  const probeEnd = pacific.mostRecentCompleteDay.end;
  const probeStart = shiftCalendarDays(probeEnd, -(lookback - 1));
  const probeRange: DateRange = { start: probeStart, end: probeEnd };

  let newestObservedActivityDate: string | null = null;
  for (const row of input.rows) {
    if (!parseIsoDate(row.date)) continue;
    const volume = (row.impressions ?? 0) + (row.clicks ?? 0);
    if (volume <= 0) continue;
    if (
      !newestObservedActivityDate ||
      row.date > newestObservedActivityDate
    ) {
      newestObservedActivityDate = row.date;
    }
  }

  const metaIncomplete =
    input.firstIncompleteDate && parseIsoDate(input.firstIncompleteDate)
      ? input.firstIncompleteDate
      : null;

  let firstIncompleteDate: string | null;
  let newestFinalizedDate: string | null;
  let boundarySource: GscFreshnessBoundary["boundarySource"];

  if (metaIncomplete) {
    boundarySource = "metadata";
    firstIncompleteDate = metaIncomplete;
    newestFinalizedDate = shiftCalendarDays(metaIncomplete, -1);
    // Never claim finalized beyond the probe end / complete Pacific day.
    if (newestFinalizedDate > probeEnd) {
      newestFinalizedDate = probeEnd;
    }
  } else {
    boundarySource = "conservative-fallback";
    newestFinalizedDate = shiftCalendarDays(
      probeEnd,
      -GSC_FALLBACK_INCOMPLETE_LAG_DAYS,
    );
    firstIncompleteDate = shiftCalendarDays(newestFinalizedDate, 1);
  }

  // Finalized must not include incomplete days when metadata present.
  if (
    firstIncompleteDate &&
    newestFinalizedDate &&
    newestFinalizedDate >= firstIncompleteDate
  ) {
    newestFinalizedDate = shiftCalendarDays(firstIncompleteDate, -1);
  }

  const ageDays =
    newestFinalizedDate == null
      ? null
      : Math.round(
          (parseDateUtcNoon(probeEnd).getTime() -
            parseDateUtcNoon(newestFinalizedDate).getTime()) /
            86_400_000,
        );

  const lag = classifyGscSourceLag(ageDays);

  return {
    newestFinalizedDate,
    firstIncompleteDate,
    newestObservedActivityDate,
    boundarySource,
    sourceTimezone: GSC_SOURCE_TIMEZONE,
    ageDays,
    lagClassification: lag.lagClassification,
    healthCode: lag.healthCode,
    confidenceMultiplier: lag.confidenceMultiplier,
    probeRange,
  };
}

function parseDateUtcNoon(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/** Lag of finalized Pacific boundary vs most recent complete Pacific day. */
export function classifyGscSourceLag(ageDays: number | null): {
  lagClassification:
    | "fresh"
    | "normal-delay"
    | "elevated-delay"
    | "unusual-stale"
    | "unknown";
  healthCode: MeasurementHealthCode;
  confidenceMultiplier: number;
} {
  if (ageDays == null || ageDays < 0) {
    return {
      lagClassification: "unknown",
      healthCode: "stale-unusual",
      confidenceMultiplier: 0.55,
    };
  }
  if (ageDays <= 1) {
    return {
      lagClassification: "fresh",
      healthCode: "ok",
      confidenceMultiplier: 1,
    };
  }
  if (ageDays <= 3) {
    return {
      lagClassification: "normal-delay",
      healthCode: "stale-within-normal-delay",
      confidenceMultiplier: 0.92,
    };
  }
  if (ageDays <= 5) {
    return {
      lagClassification: "elevated-delay",
      healthCode: "stale-within-normal-delay",
      confidenceMultiplier: 0.8,
    };
  }
  return {
    lagClassification: "unusual-stale",
    healthCode: "stale-unusual",
    confidenceMultiplier: 0.55,
  };
}

/**
 * Extract first_incomplete_date from API metadata (snake_case or camelCase).
 * Never returns non-date strings.
 */
export function extractFirstIncompleteDate(
  metadata: unknown,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const rec = metadata as Record<string, unknown>;
  const raw =
    rec.first_incomplete_date ??
    rec.firstIncompleteDate ??
    null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return parseIsoDate(trimmed) ? trimmed : null;
}

export function mapDateDimensionRows(
  rows: Array<{
    keys?: string[];
    impressions?: number;
    clicks?: number;
  }>,
): GscDateActivityRow[] {
  return rows
    .map((r) => ({
      date: r.keys?.[0] ?? "",
      impressions: r.impressions ?? 0,
      clicks: r.clicks ?? 0,
    }))
    .filter((r) => parseIsoDate(r.date));
}
