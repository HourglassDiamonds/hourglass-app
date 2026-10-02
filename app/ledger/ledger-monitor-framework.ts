/**
 * Shared Ledger monitor framework — evidence cutoff, qualitative states,
 * source records, and append-only weekly snapshots.
 *
 * Public pages consume the latest snapshot. Prior snapshots remain in the
 * series array so future reviews append rather than overwrite history.
 */

export const LEDGER_METHODOLOGY_VERSION = "qualitative-v1";

/** Shared evidence cutoff for the current public review cycle. */
export const LEDGER_EVIDENCE_CUTOFF = "October 1, 2026";

export const LEDGER_EVIDENCE_CUTOFF_LABEL = `Evidence reviewed through ${LEDGER_EVIDENCE_CUTOFF}`;

export const LEDGER_METHOD_NOTICE =
  "Individual monitors are qualitative. They use states, direction, documented evidence, and defined change triggers. System Temperature, published on the Ledger hub, is the only composite numerical reading.";

export type LedgerQualitativeStateId =
  | "low"
  | "elevated"
  | "high"
  | "very-high"
  | "critical";

export const LEDGER_QUALITATIVE_STATES = [
  {
    id: "low" as const,
    label: "Low",
    definition: "Limited pressure; normal system flexibility.",
  },
  {
    id: "elevated" as const,
    label: "Elevated",
    definition: "Meaningful pressure is present but comfortably absorbed.",
  },
  {
    id: "high" as const,
    label: "High",
    definition: "Persistent constraints or risks require active adaptation.",
  },
  {
    id: "very-high" as const,
    label: "Very High",
    definition: "Severe pressure is confirmed across multiple relevant channels.",
  },
  {
    id: "critical" as const,
    label: "Critical",
    definition:
      "Material system-level transmission, failure, or loss of normal flexibility is confirmed.",
  },
] as const;

export type LedgerEvidenceSource = {
  /** Institution or publisher */
  institution: string;
  /** Report, release, article, or dataset name */
  title: string;
  /** Publication or access date */
  date: string;
  /** External URL when available */
  url?: string;
  /** Which current claim this source supports */
  supports: string;
  /** Evidence posture when the source is time-sensitive or not final. */
  evidenceLabel?: "Observed" | "Estimated" | "Forecast" | "Provisional" | "Lagged";
  /** Period represented by the observation, distinct from publication date. */
  dataPeriod?: string;
};

export type LedgerMonitorSnapshot = {
  /** What the monitor measures and what it does not claim to measure. */
  definition: string;
  /** Public status label for this review. */
  status: string;
  /** Editorial confidence in the evidence available for this review. */
  confidence: string;
  /** Evidence conditions that would justify a more concerning assessment. */
  escalationCriteria: string;
  /** Evidence conditions that would justify a less concerning assessment. */
  easingCriteria: string;
  /** Date this snapshot was last reviewed or updated. */
  lastUpdated: string;
  reviewDate: string;
  evidenceCutoff: string;
  currentState: string;
  currentDirection: string;
  previousState: string | null;
  materialChangeSummary: string;
  sources: readonly LedgerEvidenceSource[];
  methodologyVersion: string;
};

type LegacyLedgerMonitorSnapshot = Omit<
  LedgerMonitorSnapshot,
  | "definition"
  | "status"
  | "confidence"
  | "escalationCriteria"
  | "easingCriteria"
  | "lastUpdated"
> &
  Partial<
    Pick<
      LedgerMonitorSnapshot,
      | "definition"
      | "status"
      | "confidence"
      | "escalationCriteria"
      | "easingCriteria"
      | "lastUpdated"
    >
  >;

/**
 * Append-only series container. New reviews should push a new snapshot;
 * do not mutate prior entries in place.
 */
export type LedgerMonitorSeries = {
  id: string;
  methodologyVersion: string;
  snapshots: readonly LedgerMonitorSnapshot[];
};

type LedgerMonitorSeriesInput = Omit<LedgerMonitorSeries, "snapshots"> & {
  /** Stable definition inherited by snapshots that predate the expanded schema. */
  definition: string;
  snapshots: readonly LegacyLedgerMonitorSnapshot[];
};

const NOT_YET_FORMALIZED = "Not yet formalized";

/**
 * Normalizes pre-contract history into the public snapshot contract without
 * inventing evidence. Missing historical confidence or trigger fields remain
 * visibly unformalized rather than being inferred after the fact.
 */
export function defineLedgerMonitorSeries(
  series: LedgerMonitorSeriesInput,
): LedgerMonitorSeries {
  return {
    id: series.id,
    methodologyVersion: series.methodologyVersion,
    snapshots: series.snapshots.map((snapshot) => ({
      ...snapshot,
      definition: snapshot.definition ?? series.definition,
      status: snapshot.status ?? snapshot.currentState,
      confidence: snapshot.confidence ?? NOT_YET_FORMALIZED,
      escalationCriteria:
        snapshot.escalationCriteria ?? NOT_YET_FORMALIZED,
      easingCriteria: snapshot.easingCriteria ?? NOT_YET_FORMALIZED,
      lastUpdated: snapshot.lastUpdated ?? snapshot.reviewDate,
    })),
  };
}

export function latestSnapshot(
  series: LedgerMonitorSeries,
): LedgerMonitorSnapshot {
  const latest = series.snapshots[series.snapshots.length - 1];
  if (!latest) {
    throw new Error(`Monitor series "${series.id}" has no snapshots`);
  }
  return latest;
}

/** Helper to append a snapshot without mutating the prior array reference. */
export function appendSnapshot(
  series: LedgerMonitorSeries,
  snapshot: LedgerMonitorSnapshot,
): LedgerMonitorSeries {
  return {
    ...series,
    snapshots: [...series.snapshots, snapshot],
  };
}
