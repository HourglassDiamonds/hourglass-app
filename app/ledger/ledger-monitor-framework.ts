/**
 * Shared Ledger monitor framework — evidence cutoff, qualitative states,
 * source records, and append-only weekly snapshots.
 *
 * Public pages consume the latest snapshot. Prior snapshots remain in the
 * series array so future reviews append rather than overwrite history.
 */

export const LEDGER_METHODOLOGY_VERSION = "qualitative-v1";

/** Shared evidence cutoff for the current public review cycle. */
export const LEDGER_EVIDENCE_CUTOFF = "August 12, 2026";

export const LEDGER_EVIDENCE_CUTOFF_LABEL = `Evidence reviewed through ${LEDGER_EVIDENCE_CUTOFF}`;

export const LEDGER_STATUS_LABEL =
  "Interim status — methodology revision in progress";

export const LEDGER_METHOD_NOTICE =
  "Composite numerical scoring is paused while the methodology is standardized and historically validated. Current readings use qualitative states, direction, documented evidence, and defined change triggers.";

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
};

export type LedgerMonitorSnapshot = {
  reviewDate: string;
  evidenceCutoff: string;
  currentState: string;
  currentDirection: string;
  previousState: string | null;
  materialChangeSummary: string;
  sources: readonly LedgerEvidenceSource[];
  methodologyVersion: string;
};

/**
 * Append-only series container. New reviews should push a new snapshot;
 * do not mutate prior entries in place.
 */
export type LedgerMonitorSeries = {
  id: string;
  methodologyVersion: string;
  snapshots: readonly LedgerMonitorSnapshot[];
};

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
