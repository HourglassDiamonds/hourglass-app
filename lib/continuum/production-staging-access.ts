export const PRODUCTION_STAGING_LOGIN_PATH =
  "/executive-dashboard/staging-login" as const;
export const PRODUCTION_STAGING_AUTH_ROUTE =
  "/api/continuum/production-staging-founder-auth" as const;
export const PRODUCTION_STAGING_CONTINUUM_PATH =
  "/executive-dashboard/concierge/staging-read-only" as const;
export const PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH =
  "/executive-dashboard/concierge/sterling-today/operational-review" as const;

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
  const operationalShadow = input.allowOperationalShadowAction === true &&
    input.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH;

  if (input.hasNextServerActionHeader) {
    return method === "POST" && operationalShadow
      ? { allowed: true }
      : { allowed: false, reason: "server-action-denied" };
  }

  if (method === "POST") {
    return input.pathname === PRODUCTION_STAGING_AUTH_ROUTE
      ? { allowed: true }
      : { allowed: false, reason: "method-denied" };
  }

  if (method !== "GET" && method !== "HEAD") {
    return { allowed: false, reason: "method-denied" };
  }

  if (input.pathname.startsWith("/api/")) {
    return { allowed: false, reason: "api-denied" };
  }

  if (
    (input.pathname === "/executive-dashboard" ||
      input.pathname.startsWith("/executive-dashboard/")) &&
    input.pathname !== PRODUCTION_STAGING_LOGIN_PATH &&
    input.pathname !== PRODUCTION_STAGING_CONTINUUM_PATH &&
    !operationalShadow
  ) {
    return { allowed: false, reason: "dashboard-denied" };
  }

  return { allowed: true };
}
