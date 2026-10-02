import { ACAI_SNAPSHOT } from "@/app/ledger/ai-capability-acceleration-data";
import { BUFFER_HEALTH_DOMAINS, type BufferDomain } from "@/app/ledger/buffer-health-data";
import { GPM_SNAPSHOT } from "@/app/ledger/global-pressure-monitor-data";
import { GWS_SNAPSHOT } from "@/app/ledger/global-water-stress-data";
import { ISM_SNAPSHOT } from "@/app/ledger/information-signal-map-data";
import { ISI_SNAPSHOT } from "@/app/ledger/infrastructure-strain-data";
import type { LedgerIndexId } from "@/app/ledger/ledger-data";
import type { LedgerMonitorSnapshot } from "@/app/ledger/ledger-monitor-framework";
import { PMI_SNAPSHOT } from "@/app/ledger/precious-materials-data";
import type { LedgerLiveProvider, LedgerSourceDefinition } from "./types";

const BASELINE_LAST_CHECKED = "2026-10-01T23:59:59.000Z";

type SourceMetadata = Pick<
  LedgerSourceDefinition,
  "sourceMode" | "liveProvider" | "accessMethod" | "updateFrequency" | "credentialEnv" | "maxAgeDays"
>;

function sourceMetadata(institution: string, title: string): SourceMetadata {
  if (institution === "BEA") return live("BEA_PERSONAL_INCOME", "BEA_API_KEY", "monthly", 45);
  if (institution === "BLS" && title.startsWith("Employment Situation")) {
    return live("BLS_EMPLOYMENT", undefined, "monthly", 45);
  }
  if (institution === "BLS" && title.startsWith("Job Openings")) {
    return live("BLS_JOLTS", undefined, "monthly", 45);
  }
  if (institution === "EIA" && title === "Weekly Petroleum Status Report") {
    return live("EIA_PETROLEUM", "EIA_API_KEY", "weekly", 14);
  }
  if (institution === "EIA" && title.includes("Short-Term Energy Outlook")) {
    return live("EIA_STEO", "EIA_API_KEY", "monthly", 45);
  }
  if (institution === "EIA" && title.includes("record electricity generation")) {
    return live("EIA_ELECTRICITY", "EIA_API_KEY", "daily", 14);
  }
  if (institution === "U.S. Treasury") {
    return live("TREASURY_YIELD_CURVE", undefined, "business-daily", 7);
  }
  if (institution === "St. Louis Fed / ICE") {
    return live("FRED_HIGH_YIELD_OAS", "FRED_API_KEY", "business-daily", 7);
  }
  if (institution === "St. Louis Fed") {
    return live("FRED_FINANCIAL_STRESS", "FRED_API_KEY", "weekly", 14);
  }
  return {
    sourceMode: "MANUAL_APPROVED",
    accessMethod: "approved publication/manual review",
    updateFrequency: "source-defined",
    maxAgeDays: 45,
  };
}

function live(
  liveProvider: LedgerLiveProvider,
  credentialEnv: SourceMetadata["credentialEnv"],
  updateFrequency: string,
  maxAgeDays: number,
): SourceMetadata {
  return {
    sourceMode: "LIVE",
    liveProvider,
    accessMethod: "fixed HTTPS structured feed",
    updateFrequency,
    credentialEnv,
    maxAgeDays,
  };
}

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
  return snapshot.sources.map((source, index) => {
    const sourceLocation = source.url ?? `${monitorId}:approved-source:${index + 1}`;
    return {
      sourceId: `${monitorId}:${index + 1}`,
      monitorId,
      sourceName: `${source.institution} — ${source.title}`,
      sourceAuthority: source.institution,
      sourceLocation,
      sourceUrl: sourceLocation,
      sourceType: source.url ? "PUBLICATION" : "INTERNAL_FIXTURE",
      ...sourceMetadata(source.institution, source.title),
      reliability: "MODERATE",
      required: true,
      lastChecked: BASELINE_LAST_CHECKED,
      baselineObservationTimestamp: source.date,
      baselineRawObservation: source.supports,
      baselineNormalizedObservation: {
        summary: source.supports,
        proposedMonitorState: snapshot.currentState,
        significance: "NONE",
      },
    } satisfies LedgerSourceDefinition;
  });
}

function bufferSources(domain: BufferDomain): LedgerSourceDefinition[] {
  return domain.sources.map((source, index) => {
    const sourceLocation = source.url ?? `buffer-health:${domain.id}:approved-source:${index + 1}`;
    return {
      sourceId: `buffer-health:${domain.id}:${index + 1}`,
      monitorId: "buffer-health",
      bufferDomainId: domain.id,
      sourceName: `${source.institution} — ${source.title}`,
      sourceAuthority: source.institution,
      sourceLocation,
      sourceUrl: sourceLocation,
      sourceType: source.url ? "DATASET" : "INTERNAL_FIXTURE",
      ...sourceMetadata(source.institution, source.title),
      reliability: domain.confidence.toLowerCase().includes("high") ? "HIGH" : "MODERATE",
      required: true,
      lastChecked: BASELINE_LAST_CHECKED,
      baselineObservationTimestamp: source.date,
      baselineRawObservation: source.supports,
      baselineNormalizedObservation: {
        summary: source.supports,
        proposedBufferState: domain.reserveState,
        significance: "NONE",
      },
    } satisfies LedgerSourceDefinition;
  });
}

/** Approved V1 sources, derived only from the October 1 Ledger records. */
export const LEDGER_SOURCE_REGISTRY: readonly LedgerSourceDefinition[] = [
  ...MONITORS.flatMap(([monitorId, snapshot]) => monitorSources(monitorId, snapshot)),
  ...BUFFER_HEALTH_DOMAINS.flatMap(bufferSources),
];
