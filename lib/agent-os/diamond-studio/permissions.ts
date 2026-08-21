/**
 * GREEN / YELLOW / RED mapping over Agent OS V1 permission primitives.
 * Not a second security system — thin specialist vocabulary.
 */

import { V1_PROHIBITED_ACTIONS, type ProhibitedAction } from "../types";

export type DiamondStudioAgentPermissionTier = "green" | "yellow" | "red";

export const DIAMOND_STUDIO_AGENT_GREEN_CAPABILITIES = [
  "inspect-repository",
  "run-studio-health-checks",
  "accept-typed-anonymous-events",
  "summarize-studio-activity-without-identity",
  "summarize-identified-studio-activity-without-intent",
  "draft-integrity-findings",
] as const;

export const DIAMOND_STUDIO_AGENT_YELLOW_CAPABILITIES = [
  "propose-visualization-changes",
  "recommend-studio-roadmap-items",
] as const;

export const DIAMOND_STUDIO_AGENT_RED_CAPABILITIES = [
  "autonomous-emailing",
  "autonomous-client-outreach",
  "create-hubspot-deal-from-emailed-view",
  "subscribe-emailed-view-to-marketing",
  "infer-identity-from-ga",
  "put-pii-in-analytics",
  "put-pii-in-snapshot-urls",
  "infer-ring-size-from-photograph",
] as const;

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bemail\b.*\b(client|customer|lead|prospect)/i,
  /\boutreach\b/i,
  /\bidentif(y|ication)\b.*\b(visitor|user|ga)\b/i,
  /\braw email\b/i,
  /\binfer\b.*\bring size\b/i,
];

export function classifyDiamondStudioAgentPermissionTier(
  proposedAction: string,
): DiamondStudioAgentPermissionTier {
  if (RED_ACTION_PATTERNS.some((re) => re.test(proposedAction))) return "red";
  if (/\brecommend\b|\bpropose\b/i.test(proposedAction)) return "yellow";
  return "green";
}

export function diamondStudioAgentMapsOntoV1Prohibitions(): readonly ProhibitedAction[] {
  return V1_PROHIBITED_ACTIONS;
}

export function diamondStudioAgentMayExecute(action: string): boolean {
  return classifyDiamondStudioAgentPermissionTier(action) === "green";
}
