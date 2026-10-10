import {
  ACAI_FRONTIER_WATCHLIST,
  ACAI_SNAPSHOT,
  ACAI_SUMMARY,
} from "@/app/ledger/ai-capability-acceleration-data";
import {
  BUFFER_HEALTH_DOMAINS,
  BUFFER_HEALTH_SNAPSHOT,
  SYSTEMS_FUNCTIONING_BUFFER_QUALIFIER,
} from "@/app/ledger/buffer-health-data";
import { getLedgerIndex } from "@/app/ledger/ledger-data";
import { WEEKLY_SYNOPSIS } from "@/app/ledger/components/weekly-synopsis";
import {
  GPM_LEAD,
  GPM_SNAPSHOT,
  GPM_WATCHING_BLOCKS,
  GPM_WHAT_CHANGED,
} from "@/app/ledger/global-pressure-monitor-data";
import {
  GWS_SNAPSHOT,
  GWS_SUMMARY,
  GWS_WHAT_WATCHING,
} from "@/app/ledger/global-water-stress-data";
import {
  ISM_SNAPSHOT,
  ISM_SUMMARY,
  ISM_WHAT_TO_WATCH,
} from "@/app/ledger/information-signal-map-data";
import {
  ISI_SNAPSHOT,
  ISI_SUMMARY,
  ISI_WHAT_WATCHING,
} from "@/app/ledger/infrastructure-strain-data";
import {
  PMI_SNAPSHOT,
  PMI_WHAT_MOVED,
  PMI_WHAT_TO_WATCH,
} from "@/app/ledger/precious-materials-data";
import {
  SYSTEM_TEMPERATURE_LEDGER_NOTE,
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_10,
} from "@/app/ledger/system-temperature";
import type {
  LedgerMonitorSnapshot,
} from "@/app/ledger/ledger-monitor-framework";
import type {
  LedgerPublication,
  LedgerPublicationMonitor,
} from "./publication-types";

export const OCTOBER_10_LEDGER_PUBLICATION_ID = "ledger-2026-10-10";
export const OCTOBER_10_LEDGER_COMMIT = "b8964469701d85fb17a8995784ffe282e09c6d36";

const publicationDate = "October 10, 2026";

function monitor(
  id: LedgerPublicationMonitor["id"],
  snapshot: LedgerMonitorSnapshot,
  summary: string,
  watchItems: readonly string[],
): LedgerPublicationMonitor {
  return {
    id,
    publicationDate,
    evidenceReviewedThrough: publicationDate,
    state: snapshot.currentState,
    direction: snapshot.currentDirection,
    hubState: snapshot.currentState,
    hubDirection: snapshot.currentDirection,
    hubSummary: getLedgerIndex(id).hubDescription,
    summary,
    supportingEvidence: snapshot.sources.map((source) => source.supports),
    counterEvidence: [],
    watchItems,
    sourceReferences: snapshot.sources,
  };
}

const sourceCount = [
  GPM_SNAPSHOT,
  ACAI_SNAPSHOT,
  PMI_SNAPSHOT,
  ISI_SNAPSHOT,
  GWS_SNAPSHOT,
  ISM_SNAPSHOT,
].reduce((total, snapshot) => total + snapshot.sources.length, 0) +
  BUFFER_HEALTH_DOMAINS.reduce((total, domain) => total + domain.sources.length, 0);

/** Frozen runtime fallback and first immutable publication in the V2 chain. */
export const OCTOBER_10_LEDGER_PUBLICATION: LedgerPublication = {
  schemaVersion: "ledger-publication-v2",
  publicationId: OCTOBER_10_LEDGER_PUBLICATION_ID,
  publicationDate,
  evidenceReviewedThrough: publicationDate,
  createdAt: "2026-10-10T12:00:00.000Z",
  approvedAt: "2026-10-10T12:00:00.000Z",
  publishedAt: "2026-10-10T12:00:00.000Z",
  runId: `production-${OCTOBER_10_LEDGER_COMMIT}`,
  runType: "FRIDAY_DELTA",
  previousPublicationId: "ledger-2026-10-01",
  overall: {
    temperature: SYSTEM_TEMPERATURE_READING.degrees,
    qualitativeState: SYSTEM_TEMPERATURE_READING.bandLabel,
    systemicDirection: SYSTEM_TEMPERATURE_READING.functioningLabel,
    confidence: SYSTEM_TEMPERATURE_READING.confidence,
    ledgerNote: SYSTEM_TEMPERATURE_LEDGER_NOTE,
    synopsis: WEEKLY_SYNOPSIS.headline,
    whatChanged: [WEEKLY_SYNOPSIS.blocks[0].body],
    temperatureSnapshot: SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_10,
  },
  monitors: [
    monitor("global-pressure", GPM_SNAPSHOT, GPM_LEAD, [
      GPM_WHAT_CHANGED,
      ...GPM_WATCHING_BLOCKS.map((item) => `${item.title}: ${item.body}`),
    ]),
    monitor("ai-capability", ACAI_SNAPSHOT, ACAI_SUMMARY, ACAI_FRONTIER_WATCHLIST.map((item) => `${item.title}: ${item.body}`)),
    monitor("precious-materials", PMI_SNAPSHOT, PMI_WHAT_MOVED.join(" "), PMI_WHAT_TO_WATCH),
    monitor("infrastructure-strain", ISI_SNAPSHOT, ISI_SUMMARY, ISI_WHAT_WATCHING.map((item) => `${item.title}: ${item.body}`)),
    monitor("global-water-stress", GWS_SNAPSHOT, GWS_SUMMARY, GWS_WHAT_WATCHING.map((item) => `${item.title}: ${item.body}`)),
    monitor("information-signal", ISM_SNAPSHOT, ISM_SUMMARY, ISM_WHAT_TO_WATCH.map((item) => `${item.title}: ${item.body}`)),
  ],
  bufferHealth: {
    publicationDate,
    evidenceReviewedThrough: publicationDate,
    state: BUFFER_HEALTH_SNAPSHOT.currentState,
    direction: BUFFER_HEALTH_SNAPSHOT.currentDirection,
    summary: getLedgerIndex("buffer-health").hubDescription,
    functioningQualifier: SYSTEMS_FUNCTIONING_BUFFER_QUALIFIER,
    domains: BUFFER_HEALTH_DOMAINS.map((domain) => ({
      id: domain.id,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
      state: domain.reserveState,
      direction: null,
      rationale: domain.rationale,
      supportingEvidence: domain.sources.map((source) => source.supports),
      counterEvidence: [],
      sourceReferences: domain.sources,
    })),
  },
  historicalComparison: {
    previousPublicationId: "ledger-2026-10-01",
    previousPublicationDate: "October 1, 2026",
    temperatureDelta: 0,
  },
  audit: {
    sourceHealthSummary: {
      OK: sourceCount,
      STALE: 0,
      UNAVAILABLE: 0,
      INVALID: 0,
      RATE_LIMITED: 0,
      AUTH_REQUIRED: 0,
      MANUAL_REVIEW_REQUIRED: 0,
    },
    classification: "APPROVAL_REQUIRED",
    approvalRequired: true,
    founderDecision: null,
    publicationStatus: "PUBLISHED",
    methodologyChanged: false,
    materiallyNewNarrativeClaim: true,
    requiredSourceFailure: false,
    validationWarnings: [],
  },
};
