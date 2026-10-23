import "server-only";

export const STERLING_TODAY_SEMANTIC_FLAG = "CONTINUUM_STERLING_TODAY_SEMANTIC_ENABLED" as const;
export const STERLING_TODAY_SARAH_SEMANTIC_FLAG =
  "CONTINUUM_STERLING_TODAY_SARAH_SEMANTIC_ENABLED" as const;
export const STERLING_TODAY_DURABLE_LEASE_FLAG = "CONTINUUM_STERLING_TODAY_DURABLE_LEASE_ENABLED" as const;
export const STERLING_TODAY_CONTINUITY_HMAC_ENV = "CONTINUUM_STERLING_TODAY_CONTINUITY_HMAC_KEY" as const;

export function isSterlingTodaySemanticFeatureEnabled(): boolean {
  return process.env[STERLING_TODAY_SEMANTIC_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingTodaySarahSemanticFeatureEnabled(): boolean {
  return process.env[STERLING_TODAY_SARAH_SEMANTIC_FLAG]?.trim().toLowerCase() === "true";
}

export function isSterlingTodayDurableLeaseAvailable(): boolean {
  return process.env[STERLING_TODAY_DURABLE_LEASE_FLAG]?.trim().toLowerCase() === "true";
}

export function getSterlingTodayContinuityHmacKey(): string | null {
  const value = process.env[STERLING_TODAY_CONTINUITY_HMAC_ENV]?.trim() ?? "";
  return Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}
