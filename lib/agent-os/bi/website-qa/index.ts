/**
 * Website / Engineering QA specialist under Business Intelligence.
 * GREEN / read-only. Healthy → silent. Exception → at most one root rec.
 */

import type { ConversionMeasurementAudit } from "../types";
import type { Recommendation } from "../../types";
import {
  conversionIntegrityFromAudit,
  deriveOverallHealth,
} from "./evidence";
import {
  buildWebsiteQaException,
  websiteQaExceptionToRecommendation,
} from "./exceptions";
import { probeCriticalRoute, skippedRouteProbe } from "./probe";
import type { WebsiteQaProbeFn } from "./probe";
import {
  WEBSITE_QA_CRITICAL_ROUTES,
  type WebsiteQaSnapshot,
} from "./types";

export type RunWebsiteQaOptions = {
  liveHttp?: boolean;
  probe?: WebsiteQaProbeFn;
  conversionAudit?: ConversionMeasurementAudit | null;
  reportingPeriod?: { start: string; end: string };
  collectedAt?: string;
  /** Injected route probes — tests only. */
  routeProbes?: WebsiteQaSnapshot["routes"];
};

export function emptyWebsiteQaSnapshot(): WebsiteQaSnapshot {
  return {
    health: "unknown",
    routes: WEBSITE_QA_CRITICAL_ROUTES.map((route) => skippedRouteProbe(route)),
    conversionIntegrity: {
      state: "unknown",
      decisionBlockingCount: 0,
      epistemicClass: "unknown",
      notes: ["QA not executed"],
    },
    exception: null,
    facts: ["Website QA not executed"],
    inferences: [
      "Missing production HTTP evidence is UNKNOWN, not an automatic incident",
    ],
  };
}

export async function runWebsiteQaSpecialist(
  options: RunWebsiteQaOptions = {},
): Promise<WebsiteQaSnapshot> {
  const conversionIntegrity = conversionIntegrityFromAudit(
    options.conversionAudit,
  );

  const routes =
    options.routeProbes ??
    (options.liveHttp
      ? await Promise.all(
          WEBSITE_QA_CRITICAL_ROUTES.map((route) =>
            probeCriticalRoute(route, options.probe),
          ),
        )
      : WEBSITE_QA_CRITICAL_ROUTES.map((route) => skippedRouteProbe(route)));

  const health = deriveOverallHealth(routes);
  const exception = buildWebsiteQaException(health, routes);

  const facts = [
    `Production health: ${health}`,
    `Critical routes probed: ${routes.length}`,
    `QA founder exception: ${exception ? "1" : "0"}`,
  ];

  const inferences = [
    "Healthy production emits zero Website QA founder recommendations",
    "Timeout/unavailable probes are UNKNOWN, not invented outages",
    "Low-volume analytics is not a QA regression",
    "Completed Concierge / Studio / a11y / schema work is not reopened without a demonstrated production regression",
  ];

  return {
    health,
    routes,
    conversionIntegrity,
    exception,
    facts,
    inferences,
  };
}

export function withConversionAudit(
  snapshot: WebsiteQaSnapshot,
  audit: ConversionMeasurementAudit | null | undefined,
): WebsiteQaSnapshot {
  return {
    ...snapshot,
    conversionIntegrity: conversionIntegrityFromAudit(audit),
  };
}

export function websiteQaRecommendations(
  snapshot: WebsiteQaSnapshot,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation[] {
  if (!snapshot.exception) return [];
  const rec = websiteQaExceptionToRecommendation(
    snapshot.exception,
    reportingPeriod,
    collectedAt,
  );
  return rec ? [rec] : [];
}

export {
  WEBSITE_QA_CRITICAL_ROUTES,
  WEBSITE_QA_ROOT_EXCEPTION_ID,
  WEBSITE_QA_PRODUCTION_HOST,
  type WebsiteQaSnapshot,
  type WebsiteQaHealthState,
  type WebsiteQaRouteProbe,
} from "./types";
export {
  classifyWebsiteQaPermissionTier,
  websiteQaMayExecute,
  WEBSITE_QA_GREEN_CAPABILITIES,
  WEBSITE_QA_YELLOW_CAPABILITIES,
  WEBSITE_QA_RED_CAPABILITIES,
} from "./permissions";
export { injectWebsiteQaCriticalIntoSurfacePool } from "./cos-escalation";
export { skippedRouteProbe, mapLiveProbeToRouteProbe } from "./probe";
