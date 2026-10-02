import { ACAI_SNAPSHOT } from "@/app/ledger/ai-capability-acceleration-data";
import { BUFFER_HEALTH_DOMAINS, type BufferDomain } from "@/app/ledger/buffer-health-data";
import { GPM_SNAPSHOT } from "@/app/ledger/global-pressure-monitor-data";
import { GWS_SNAPSHOT } from "@/app/ledger/global-water-stress-data";
import { ISM_SNAPSHOT } from "@/app/ledger/information-signal-map-data";
import { ISI_SNAPSHOT } from "@/app/ledger/infrastructure-strain-data";
import type { LedgerIndexId } from "@/app/ledger/ledger-data";
import type { LedgerMonitorSnapshot } from "@/app/ledger/ledger-monitor-framework";
import { PMI_SNAPSHOT } from "@/app/ledger/precious-materials-data";
import type { LedgerSourceDefinition } from "./types";

const BASELINE_LAST_CHECKED = "2026-10-01T23:59:59.000Z";

const MONITORS: readonly [Exclude<LedgerIndexId, "buffer-health">, LedgerMonitorSnapshot][] = [
  ["global-pressure", GPM_SNAPSHOT],
  ["ai-capability", ACAI_SNAPSHOT],
  ["precious-materials", PMI_SNAPSHOT],
  ["infrastructure-strain", ISI_SNAPSHOT],
  ["global-water-stress", GWS_SNAPSHOT],
  ["information-signal", ISM_SNAPSHOT],
];

function monitorSources(
  monitorId: Exclude<LedgerIndexId, "buffer-health">,
  snapshot: LedgerMonitorSnapshot,
): LedgerSourceDefinition[] {
  return snapshot.sources.map((source, index) => ({
    sourceId: `${monitorId}:${index + 1}`,
    monitorId,
    sourceName: `${source.institution} — ${source.title}`,
    sourceLocation: source.url ?? `${monitorId}:approved-source:${index + 1}`,
    sourceType: source.url ? "PUBLICATION" : "INTERNAL_FIXTURE",
    reliability: "MODERATE",
    required: true,
    maxAgeDays: 45,
    lastChecked: BASELINE_LAST_CHECKED,
    baselineObservationTimestamp: source.date,
    baselineRawObservation: source.supports,
    baselineNormalizedObservation: {
      summary: source.supports,
      proposedMonitorState: snapshot.currentState,
      significance: "NONE",
    },
  }));
}

function bufferSources(domain: BufferDomain): LedgerSourceDefinition[] {
  return domain.sources.map((source, index) => ({
    sourceId: `buffer-health:${domain.id}:${index + 1}`,
    monitorId: "buffer-health",
    bufferDomainId: domain.id,
    sourceName: `${source.institution} — ${source.title}`,
    sourceLocation: source.url ?? `buffer-health:${domain.id}:approved-source:${index + 1}`,
    sourceType: source.url ? "DATASET" : "INTERNAL_FIXTURE",
    reliability: domain.confidence.toLowerCase().includes("high") ? "HIGH" : "MODERATE",
    required: true,
    maxAgeDays: 45,
    lastChecked: BASELINE_LAST_CHECKED,
    baselineObservationTimestamp: source.date,
    baselineRawObservation: source.supports,
    baselineNormalizedObservation: {
      summary: source.supports,
      proposedBufferState: domain.reserveState,
      significance: "NONE",
    },
  }));
}

/** Approved V1 sources, derived only from the October 1 Ledger records. */
export const LEDGER_SOURCE_REGISTRY: readonly LedgerSourceDefinition[] = [
  ...MONITORS.flatMap(([monitorId, snapshot]) => monitorSources(monitorId, snapshot)),
  ...BUFFER_HEALTH_DOMAINS.flatMap(bufferSources),
];
