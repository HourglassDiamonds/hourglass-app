import {
  BUFFER_HEALTH_FORMAL_SNAPSHOTS,
  reserveFillPercent,
  type BufferHealthHistoricalSnapshot,
} from "./buffer-health-data";
import {
  computeTemperatureDegrees,
  SYSTEM_TEMPERATURE_SNAPSHOTS,
  type SystemTemperatureSnapshot,
} from "./system-temperature";

export const LEDGER_COMPARISON_PERIODS = ["1M", "3M", "6M", "12M"] as const;

export type LedgerComparisonPeriod = (typeof LEDGER_COMPARISON_PERIODS)[number];

const PERIOD_MONTHS: Record<LedgerComparisonPeriod, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "12M": 12,
};

const NO_FORMAL_BASELINE = "No formal baseline is available for this period.";

function dateValue(reviewDate: string): number {
  const value = Date.parse(`${reviewDate} 00:00:00 UTC`);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid Ledger review date: ${reviewDate}`);
  }
  return value;
}

export function comparisonTargetDate(
  currentReviewDate: string,
  period: LedgerComparisonPeriod,
): Date {
  const current = new Date(dateValue(currentReviewDate));
  current.setUTCMonth(current.getUTCMonth() - PERIOD_MONTHS[period]);
  return current;
}

export function formatLedgerComparisonDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function snapshotAtOrBefore<T extends { reviewDate: string }>(
  snapshots: readonly T[],
  target: Date,
): T | null {
  const targetValue = target.getTime();
  return (
    [...snapshots]
      .filter((snapshot) => dateValue(snapshot.reviewDate) <= targetValue)
      .sort((a, b) => dateValue(b.reviewDate) - dateValue(a.reviewDate))[0] ?? null
  );
}

export type SystemHistoryComparison = {
  available: boolean;
  currentDate: string;
  currentDegrees: number;
  targetDate: string;
  comparisonDate: string | null;
  comparisonDegrees: number | null;
  delta: number | null;
  unavailableMessage: string | null;
};

export type BufferHistoryComparison = {
  available: boolean;
  currentDate: string;
  targetDate: string;
  comparisonDate: string | null;
  currentDomains: readonly {
    id: string;
    label: string;
    state: string;
    fill: number | null;
  }[];
  comparisonDomains: readonly {
    id: string;
    state: string;
    fill: number | null;
  }[];
  unavailableMessage: string | null;
};

export type LedgerHistoricalComparison = {
  period: LedgerComparisonPeriod;
  system: SystemHistoryComparison;
  buffer: BufferHistoryComparison;
};

function buildSystemComparison(
  period: LedgerComparisonPeriod,
  snapshots: readonly SystemTemperatureSnapshot[],
): SystemHistoryComparison {
  const current = snapshots.at(-1);
  if (!current) throw new Error("System Temperature history is empty");
  const target = comparisonTargetDate(current.reviewDate, period);
  const comparison = snapshotAtOrBefore(snapshots.slice(0, -1), target);
  const currentDegrees = computeTemperatureDegrees(current);

  return {
    available: comparison !== null,
    currentDate: current.reviewDate,
    currentDegrees,
    targetDate: formatLedgerComparisonDate(target),
    comparisonDate: comparison?.reviewDate ?? null,
    comparisonDegrees: comparison ? computeTemperatureDegrees(comparison) : null,
    delta: comparison
      ? currentDegrees - computeTemperatureDegrees(comparison)
      : null,
    unavailableMessage: comparison ? null : NO_FORMAL_BASELINE,
  };
}

function buildBufferComparison(
  period: LedgerComparisonPeriod,
  snapshots: readonly BufferHealthHistoricalSnapshot[],
): BufferHistoryComparison {
  const current = snapshots.at(-1);
  if (!current) throw new Error("Buffer Health formal history is empty");
  const target = comparisonTargetDate(current.reviewDate, period);
  const comparison = snapshotAtOrBefore(snapshots.slice(0, -1), target);

  return {
    available: comparison !== null,
    currentDate: current.reviewDate,
    targetDate: formatLedgerComparisonDate(target),
    comparisonDate: comparison?.reviewDate ?? null,
    currentDomains: current.domains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      state: domain.reserveState,
      fill: reserveFillPercent(domain.reserveState),
    })),
    comparisonDomains:
      comparison?.domains.map((domain) => ({
        id: domain.id,
        state: domain.reserveState,
        fill: reserveFillPercent(domain.reserveState),
      })) ?? [],
    unavailableMessage: comparison ? null : NO_FORMAL_BASELINE,
  };
}

export function buildLedgerHistoricalComparisons(
  systemSnapshots: readonly SystemTemperatureSnapshot[] = SYSTEM_TEMPERATURE_SNAPSHOTS,
  bufferSnapshots: readonly BufferHealthHistoricalSnapshot[] = BUFFER_HEALTH_FORMAL_SNAPSHOTS,
): readonly LedgerHistoricalComparison[] {
  return LEDGER_COMPARISON_PERIODS.map((period) => ({
    period,
    system: buildSystemComparison(period, systemSnapshots),
    buffer: buildBufferComparison(period, bufferSnapshots),
  }));
}
