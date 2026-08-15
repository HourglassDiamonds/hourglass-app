/**
 * GREEN / YELLOW / RED vocabulary for accepted-inquiry attribution.
 * Thin specialist mapping — not a second security system.
 * P1-BI-2 executes GREEN only. No CRM mutation, no analytics writes.
 */

import {
  isActionProhibited,
  proposedActionImpliesWrite,
} from "../../permissions";

export type AttributionPermissionTier = "green" | "yellow" | "red";

export const ATTRIBUTION_GREEN_CAPABILITIES = [
  "read-hubspot-records",
  "parse-attribution-lines",
  "aggregate-sanitized-evidence",
  "read-ga4-aggregate-counts",
  "report",
] as const;

export const ATTRIBUTION_YELLOW_CAPABILITIES = [
  "prepare-capture-repair-plan",
] as const;

export const ATTRIBUTION_RED_CAPABILITIES = [
  "mutate-hubspot",
  "create-crm-properties",
  "send-email",
  "export-pii",
  "send-identity-to-ga4",
  "alter-analytics",
  "deploy",
] as const;

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bdeploy\b/i,
  /\bpush\b.+\b(production|vercel|main)\b/i,
  /\bsend\b.+\bemail\b/i,
  /\bexport\b.+\b(pii|email|contact)\b/i,
  /\bmutate\b.+\b(crm|hubspot|analytics)\b/i,
  /\bcreate\b.+\b(hubspot|crm)\b.+\bpropert/i,
  /\buser_id\b.+\bemail\b/i,
];

const YELLOW_ACTION_PATTERNS: RegExp[] = [
  /\bprepare\b.+\b(repair|capture)\b/i,
  /\bdraft\b.+\b(repair|patch)\b/i,
];

export function classifyAttributionPermissionTier(
  proposedAction: string,
): AttributionPermissionTier {
  if (
    RED_ACTION_PATTERNS.some((re) => re.test(proposedAction)) ||
    proposedActionImpliesWrite(proposedAction) ||
    isActionProhibited(proposedAction)
  ) {
    return "red";
  }
  if (YELLOW_ACTION_PATTERNS.some((re) => re.test(proposedAction))) {
    return "yellow";
  }
  return "green";
}

export function attributionMayExecute(proposedAction: string): boolean {
  return classifyAttributionPermissionTier(proposedAction) === "green";
}
