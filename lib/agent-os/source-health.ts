import type { DataSourceId, SourceHealth } from "./types";
import type { MeasurementHealthCode } from "./measurement/health-codes";

export function buildSourceHealth(input: {
  sourceId: DataSourceId;
  configured: boolean;
  reachable: boolean;
  fresh: boolean;
  complete: boolean;
  permissionPosture: SourceHealth["permissionPosture"];
  lastSuccessfulRead: string | null;
  errors?: string[];
  retrievalState: SourceHealth["retrievalState"];
  healthCode?: MeasurementHealthCode;
  founderLabel?: string;
  newestSourceDate?: string | null;
  sourceAgeDays?: number | null;
}): SourceHealth {
  const errors = input.errors ?? [];
  return {
    sourceId: input.sourceId,
    configured: input.configured,
    reachable: input.reachable,
    fresh: input.fresh,
    complete: input.complete,
    permissionPosture: input.permissionPosture,
    lastSuccessfulRead: input.lastSuccessfulRead,
    errors,
    effectOnConfidence: describeConfidenceEffect(input, errors),
    retrievalState: input.retrievalState,
    healthCode: input.healthCode,
    founderLabel: input.founderLabel,
    newestSourceDate: input.newestSourceDate,
    sourceAgeDays: input.sourceAgeDays,
  };
}

function describeConfidenceEffect(
  input: {
    configured: boolean;
    reachable: boolean;
    fresh: boolean;
    complete: boolean;
    retrievalState: SourceHealth["retrievalState"];
    healthCode?: MeasurementHealthCode;
  },
  errors: string[],
): string {
  if (input.healthCode === "stale-within-normal-delay") {
    return "Normal reporting lag — evidence usable with slightly reduced confidence";
  }
  if (input.healthCode === "stale-unusual") {
    return "Unusually stale source — lower confidence; do not treat as an outage if API is healthy";
  }
  if (input.retrievalState === "fixture") {
    return "Fixture data — useful for validation; not production evidence";
  }
  if (!input.configured || input.retrievalState === "not-configured") {
    return "Source not configured — related recommendations blocked or confidence reduced";
  }
  if (input.retrievalState === "failed" || errors.length > 0) {
    return "Retrieval failed — treat as measurement gap, not business decline";
  }
  if (input.retrievalState === "empty") {
    return "Empty result set — distinct from failure; may indicate zero activity or filter mismatch";
  }
  if (!input.fresh) {
    return "Stale data — label freshness and lower confidence";
  }
  if (!input.complete) {
    return "Incomplete coverage — flag attribution/measurement gaps";
  }
  if (!input.reachable) {
    return "Configured but unreachable — do not invent metrics";
  }
  return "Healthy read — may support evidence-backed recommendations";
}

export function summarizeSourceHealth(health: SourceHealth[]): string {
  const parts = health.map((h) => {
    const flag =
      h.healthCode ??
      (h.retrievalState === "ok" || h.retrievalState === "fixture"
        ? "ok"
        : h.retrievalState);
    return `${h.sourceId}:${flag}`;
  });
  return parts.join(", ");
}
