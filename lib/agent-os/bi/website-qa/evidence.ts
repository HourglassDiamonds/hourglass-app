/**
 * Compact production-health evidence from route probes + existing BI conversion audit.
 * Missing evidence is UNKNOWN, not an incident.
 */

import type { ConversionMeasurementAudit } from "../types";
import {
  WEBSITE_QA_CRITICAL_ROUTES,
  type WebsiteQaConversionIntegrity,
  type WebsiteQaHealthState,
  type WebsiteQaRouteProbe,
} from "./types";

export function conversionIntegrityFromAudit(
  audit: ConversionMeasurementAudit | null | undefined,
): WebsiteQaConversionIntegrity {
  if (!audit || audit.observationMode === "unavailable") {
    return {
      state: "unknown",
      decisionBlockingCount: 0,
      epistemicClass: "unknown",
      notes: [
        "Conversion observation unavailable — UNKNOWN, not a QA incident",
      ],
    };
  }

  const blocking = audit.findings.filter(
    (f) => f.decisionEffect === "decision-blocking" && !f.suppressRecommendation,
  );
  if (blocking.length > 0) {
    return {
      state: "degraded",
      decisionBlockingCount: blocking.length,
      epistemicClass: "derived",
      notes: [
        "Existing BI conversion-integrity findings remain BI-owned — QA does not duplicate them",
      ],
    };
  }

  return {
    state: "healthy",
    decisionBlockingCount: 0,
    epistemicClass: "derived",
    notes: [
      "No decision-blocking conversion-integrity finding — low-volume/unknown events are not a QA regression",
    ],
  };
}

export function classifyRouteSeverity(
  probe: WebsiteQaRouteProbe,
): "critical" | "degraded" | "ok" | "unknown" {
  if (probe.epistemicClass === "unknown") return "unknown";
  if (probe.probeOutcome === "timeout") return "unknown";
  if (probe.probeOutcome === "network-failure") return "unknown";
  if (probe.probeOutcome === "skipped") return "unknown";
  if (probe.probeOutcome === "server-error") return "critical";
  if (probe.probeOutcome === "client-error") return "critical";
  if (probe.probeOutcome === "redirect") {
    const loc = probe.redirectLocation ?? "";
    const offHost =
      loc.startsWith("http") &&
      !loc.includes("hourglassdiamonds.com");
    return offHost ? "degraded" : "ok";
  }
  if (probe.probeOutcome === "ok") return "ok";
  return "unknown";
}

export function deriveOverallHealth(
  routes: readonly WebsiteQaRouteProbe[],
): WebsiteQaHealthState {
  const byRoute = new Map(
    routes.map((probe) => [probe.route, classifyRouteSeverity(probe)]),
  );
  const required = WEBSITE_QA_CRITICAL_ROUTES.map(
    (route) => byRoute.get(route) ?? "unknown",
  );
  if (required.some((s) => s === "critical")) return "critical";
  if (required.some((s) => s === "degraded")) return "degraded";
  if (required.some((s) => s === "unknown")) return "unknown";
  if (required.every((s) => s === "ok")) return "healthy";
  return "unknown";
}
