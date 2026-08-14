/**
 * Website / Engineering QA specialist — typed contracts.
 * Lives under Business Intelligence. Not a sixth executive.
 * Emotional model: Concierge SLA (healthy → silent; exception → bounded).
 */

export const WEBSITE_QA_HEALTH_STATES = [
  "healthy",
  "degraded",
  "critical",
  "unknown",
] as const;

export type WebsiteQaHealthState = (typeof WEBSITE_QA_HEALTH_STATES)[number];

export const WEBSITE_QA_EPISTEMIC_CLASSES = [
  "observed",
  "derived",
  "unknown",
] as const;

export type WebsiteQaEpistemicClass =
  (typeof WEBSITE_QA_EPISTEMIC_CLASSES)[number];

export const WEBSITE_QA_PROBE_OUTCOMES = [
  "ok",
  "redirect",
  "client-error",
  "server-error",
  "timeout",
  "network-failure",
  "skipped",
  "unknown",
] as const;

export type WebsiteQaProbeOutcome = (typeof WEBSITE_QA_PROBE_OUTCOMES)[number];

export const WEBSITE_QA_CRITICAL_ROUTES = [
  "/",
  "/concierge",
  "/engagement-rings",
  "/custom-design",
  "/diamond-studio",
  "/diamond-shape-studio",
  "/diamond-intelligence",
] as const;

export type WebsiteQaCriticalRoute =
  (typeof WEBSITE_QA_CRITICAL_ROUTES)[number];

export type WebsiteQaRouteProbe = {
  route: WebsiteQaCriticalRoute | string;
  requestUrl: string;
  status: number | null;
  /** true/false when observed; null when UNKNOWN. */
  reachable: boolean | null;
  probeOutcome: WebsiteQaProbeOutcome;
  redirectLocation: string | null;
  epistemicClass: WebsiteQaEpistemicClass;
  notes: string[];
};

export type WebsiteQaConversionIntegrity = {
  state: "healthy" | "degraded" | "unknown";
  decisionBlockingCount: number;
  epistemicClass: WebsiteQaEpistemicClass;
  notes: string[];
};

export type WebsiteQaException = {
  id: typeof WEBSITE_QA_ROOT_EXCEPTION_ID;
  health: Exclude<WebsiteQaHealthState, "healthy" | "unknown">;
  affectedRoutes: string[];
  summary: string;
};

export type WebsiteQaSnapshot = {
  health: WebsiteQaHealthState;
  routes: WebsiteQaRouteProbe[];
  conversionIntegrity: WebsiteQaConversionIntegrity;
  exception: WebsiteQaException | null;
  facts: string[];
  inferences: string[];
};

export const WEBSITE_QA_ROOT_EXCEPTION_ID =
  "business-intelligence:website-qa:production-health-regression" as const;

export const WEBSITE_QA_PRODUCTION_HOST =
  "https://www.hourglassdiamonds.com" as const;
