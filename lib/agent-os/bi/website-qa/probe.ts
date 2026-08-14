/**
 * Read-only production HTTP probes.
 * Reuses Search/GEO tech-seo live probe; adds a hard timeout.
 * Failures degrade to UNKNOWN — never invent an outage from a hang.
 */

import {
  absoluteInventoryUrl,
  defaultLiveHttpProbe,
} from "../../search/tech-seo/http-indexability";
import type { LiveHttpProbe } from "../../search/tech-seo/types";
import type {
  WebsiteQaCriticalRoute,
  WebsiteQaProbeOutcome,
  WebsiteQaRouteProbe,
} from "./types";
import { WEBSITE_QA_PRODUCTION_HOST } from "./types";

export const WEBSITE_QA_PROBE_TIMEOUT_MS = 8_000;

export type WebsiteQaProbeFn = (url: string) => Promise<LiveHttpProbe>;

function timeoutProbe(url: string): Promise<LiveHttpProbe> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        requestUrl: url,
        finalUrl: null,
        status: null,
        probeStatus: "unknown",
        locationHeader: null,
        canonicalHref: null,
        robotsMeta: null,
        soft404Risk: false,
        notes: ["QA probe timed out — UNKNOWN, not an invented outage"],
        error: "timeout",
      });
    }, WEBSITE_QA_PROBE_TIMEOUT_MS);
  });
}

function mapOutcome(probe: LiveHttpProbe): WebsiteQaProbeOutcome {
  if (probe.error === "timeout" || /timeout/i.test(probe.error ?? "")) {
    return "timeout";
  }
  if (probe.probeStatus === "skipped") return "skipped";
  if (probe.probeStatus === "unknown") {
    return probe.error ? "network-failure" : "unknown";
  }
  if (probe.probeStatus === "redirect") return "redirect";
  if (probe.probeStatus === "not-found") return "client-error";
  if (probe.probeStatus === "error") {
    const status = probe.status ?? 0;
    if (status >= 500) return "server-error";
    if (status >= 400) return "client-error";
    return "unknown";
  }
  if (probe.probeStatus === "ok") {
    const status = probe.status ?? 0;
    if (status >= 500) return "server-error";
    if (status >= 400) return "client-error";
    if (status >= 300) return "redirect";
    if (status >= 200) return "ok";
  }
  return "unknown";
}

export function mapLiveProbeToRouteProbe(
  route: string,
  probe: LiveHttpProbe,
): WebsiteQaRouteProbe {
  const outcome = mapOutcome(probe);
  const observed =
    outcome === "ok" ||
    outcome === "redirect" ||
    outcome === "client-error" ||
    outcome === "server-error";
  const reachable = observed
    ? outcome === "ok" ||
      outcome === "redirect" ||
      outcome === "client-error" ||
      outcome === "server-error"
    : null;

  return {
    route,
    requestUrl: probe.requestUrl,
    status: probe.status,
    reachable,
    probeOutcome: outcome,
    redirectLocation: probe.locationHeader,
    epistemicClass: observed ? "observed" : "unknown",
    notes: probe.notes,
  };
}

export function skippedRouteProbe(route: string): WebsiteQaRouteProbe {
  const url = route.startsWith("http")
    ? route
    : `${WEBSITE_QA_PRODUCTION_HOST}${route === "/" ? "/" : route}`;
  return {
    route,
    requestUrl: url,
    status: null,
    reachable: null,
    probeOutcome: "skipped",
    redirectLocation: null,
    epistemicClass: "unknown",
    notes: ["Live HTTP skipped — production status UNKNOWN"],
  };
}

export async function probeCriticalRoute(
  route: WebsiteQaCriticalRoute | string,
  probeFn: WebsiteQaProbeFn = defaultLiveHttpProbe,
): Promise<WebsiteQaRouteProbe> {
  const url = absoluteInventoryUrl(route);
  try {
    const probe = await Promise.race([probeFn(url), timeoutProbe(url)]);
    return mapLiveProbeToRouteProbe(route, probe);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      route,
      requestUrl: url,
      status: null,
      reachable: null,
      probeOutcome: /timeout/i.test(message) ? "timeout" : "network-failure",
      redirectLocation: null,
      epistemicClass: "unknown",
      notes: ["Probe threw — treated as UNKNOWN / INSUFFICIENT EVIDENCE"],
    };
  }
}
