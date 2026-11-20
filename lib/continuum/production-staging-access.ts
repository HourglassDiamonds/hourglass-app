export const PRODUCTION_STAGING_LOGIN_PATH =
  "/executive-dashboard/staging-login" as const;
export const PRODUCTION_STAGING_AUTH_ROUTE =
  "/api/continuum/production-staging-founder-auth" as const;
export const PRODUCTION_SHADOW_PASSKEY_BEGIN_ROUTE =
  "/api/continuum/production-shadow-founder-auth/passkey/begin" as const;
export const PRODUCTION_SHADOW_PASSKEY_COMPLETE_ROUTE =
  "/api/continuum/production-shadow-founder-auth/passkey/complete" as const;
export const PRODUCTION_SHADOW_FOUNDER_HOST =
  "sterling-shadow.hourglassdiamonds.com" as const;
export const PRODUCTION_STAGING_CONTINUUM_PATH =
  "/executive-dashboard/concierge/staging-read-only" as const;
export const PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH =
  "/executive-dashboard/concierge/sterling-today/operational-review" as const;
export const PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE =
  "/executive-dashboard/api/continuum/operational-shadow/run" as const;
export const PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE =
  "/executive-dashboard/api/continuum/operational-shadow/result" as const;
export const INTERNAL_OPERATIONAL_SHADOW_RUN_ROUTE =
  "/api/continuum/internal/operational-shadow/run" as const;
export const INTERNAL_OPERATIONAL_SHADOW_RESULT_ROUTE =
  "/api/continuum/internal/operational-shadow/result" as const;
export const OPERATIONAL_SHADOW_REWRITE_SOURCE_HEADER =
  "x-continuum-operational-shadow-source" as const;
export const OPERATIONAL_SHADOW_DISPATCH_PROBE_SEARCH =
  "?dispatch-probe=1" as const;

export function isInternalOperationalShadowPath(pathname: string): boolean {
  return pathname === INTERNAL_OPERATIONAL_SHADOW_RUN_ROUTE ||
    pathname === INTERNAL_OPERATIONAL_SHADOW_RESULT_ROUTE;
}

export function isAllowedProductionShadowFounderHostPath(
  pathname: string,
): boolean {
  return pathname === PRODUCTION_STAGING_LOGIN_PATH ||
    pathname === PRODUCTION_SHADOW_PASSKEY_BEGIN_ROUTE ||
    pathname === PRODUCTION_SHADOW_PASSKEY_COMPLETE_ROUTE ||
    pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH ||
    pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE ||
    pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE;
}

export function isOperationalShadowRewriteRequest(
  headers: Headers | { get(name: string): string | null },
  expectedSource: string,
): boolean {
  return headers.get(OPERATIONAL_SHADOW_REWRITE_SOURCE_HEADER) === expectedSource;
}

export function isOperationalShadowDispatchProbe(input: {
  method: string;
  pathname: string;
  search: string;
  hasNextServerActionHeader: boolean;
}): boolean {
  return input.method === "POST" &&
    input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE &&
    input.search === OPERATIONAL_SHADOW_DISPATCH_PROBE_SEARCH &&
    !input.hasNextServerActionHeader;
}

export type ProductionStagingRequestDecision =
  | { allowed: true }
  | { allowed: false; reason: "api-denied" | "method-denied" | "server-action-denied" | "dashboard-denied" };

/**
 * Production-backed staging is deliberately smaller than the application.
 * It exposes public GET/HEAD rendering plus one read-only dashboard page and
 * a conventional founder-auth POST. Next Server Actions are always denied,
 * including after authentication, so an action id cannot bypass path rules.
 */
export function productionStagingRequestDecision(input: {
  method: string;
  pathname: string;
  hasNextServerActionHeader: boolean;
  allowOperationalShadowAction?: boolean;
}): ProductionStagingRequestDecision {
  const method = input.method.toUpperCase();
  const operationalShadowEnabled = input.allowOperationalShadowAction === true;

  if (input.hasNextServerActionHeader) {
    return { allowed: false, reason: "server-action-denied" };
  }

  if (method === "POST") {
    return input.pathname === PRODUCTION_STAGING_AUTH_ROUTE ||
      (operationalShadowEnabled &&
        (input.pathname === PRODUCTION_SHADOW_PASSKEY_BEGIN_ROUTE ||
          input.pathname === PRODUCTION_SHADOW_PASSKEY_COMPLETE_ROUTE)) ||
      (operationalShadowEnabled &&
        (input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE ||
          input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE))
      ? { allowed: true }
      : { allowed: false, reason: "method-denied" };
  }

  if (method === "DELETE") {
    return operationalShadowEnabled && input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE
      ? { allowed: true }
      : { allowed: false, reason: "method-denied" };
  }

  if (method !== "GET" && method !== "HEAD") {
    return { allowed: false, reason: "method-denied" };
  }

  if (input.pathname.startsWith("/api/") ||
      (input.pathname.startsWith("/executive-dashboard/api/") &&
        !(operationalShadowEnabled && method === "GET" &&
          input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE))) {
    return { allowed: false, reason: "api-denied" };
  }

  if (
    (input.pathname === "/executive-dashboard" ||
      input.pathname.startsWith("/executive-dashboard/")) &&
    input.pathname !== PRODUCTION_STAGING_LOGIN_PATH &&
    input.pathname !== PRODUCTION_STAGING_CONTINUUM_PATH &&
    !(operationalShadowEnabled &&
      (input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH ||
        (method === "GET" && input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE)))
  ) {
    return { allowed: false, reason: "dashboard-denied" };
  }

  return { allowed: true };
}
