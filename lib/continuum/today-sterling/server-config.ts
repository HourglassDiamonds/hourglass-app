import "server-only";

export const STERLING_TODAY_SEMANTIC_FLAG = "CONTINUUM_STERLING_TODAY_SEMANTIC_ENABLED" as const;
export const STERLING_TODAY_DURABLE_LEASE_FLAG = "CONTINUUM_STERLING_TODAY_DURABLE_LEASE_ENABLED" as const;

export function isSterlingTodaySemanticFeatureEnabled(): boolean {
  return process.env[STERLING_TODAY_SEMANTIC_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingTodayDurableLeaseAvailable(): boolean {
  return process.env[STERLING_TODAY_DURABLE_LEASE_FLAG]?.trim().toLowerCase() === "true";
}
