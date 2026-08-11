/**
 * Production enable gate for Concierge Lead SLA (P0-5).
 * Server-only. Default OFF so code can ship before schema/scopes exist.
 */

/**
 * Full P0-5 enforcement is active only when explicitly set to the string "true".
 * Unset / false / any other value → Concierge contact+deal path unchanged;
 * no SLA ledger, tasks, alerts, watchdog mutations, or CoS SLA surfacing.
 */
export function isConciergeSlaEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.CONCIERGE_SLA_ENABLED?.trim() === "true";
}
