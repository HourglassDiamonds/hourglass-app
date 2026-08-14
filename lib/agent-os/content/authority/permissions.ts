/**
 * GREEN / YELLOW / RED vocabulary for Content Authority.
 * Thin specialist mapping over Agent OS V1 primitives — not a second security system.
 */

import {
  isActionProhibited,
  proposedActionImpliesWrite,
} from "../../permissions";

export type AuthorityPermissionTier = "green" | "yellow" | "red";

export const AUTHORITY_GREEN_CAPABILITIES = [
  "inspect-case-study-ledger",
  "analyze-case-study-readiness",
  "report-authority-status",
  "identify-next-case-study-action",
  "inspect-authority-wave-status",
] as const;

export const AUTHORITY_YELLOW_CAPABILITIES = [
  "prepare-case-study-for-publication",
  "prepare-publishing-edits",
  "prepare-follow-up-outreach-copy",
] as const;

export const AUTHORITY_RED_CAPABILITIES = [
  "publish-content",
  "send-outreach",
  "send-client-communication",
  "mutate-crm",
  "production-deployment",
  "spend-money",
  "delete-content",
] as const;

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bpublish\b/i,
  /\bsend\b.+\b(outreach|email|message)\b/i,
  /\bsend (email|sms|message) to (customer|lead)\b/i,
  /\bcontact\b.+\b(publication|editor|outlet)\b/i,
  /\bupdate hubspot\b/i,
  /\bdeploy\b/i,
  /\bspend\b|\bpurchase\b/i,
  /\bdelete\b/i,
];

const YELLOW_ACTION_PATTERNS: RegExp[] = [
  /\bprepare\b.+\b(publish|publication|follow-up|outreach copy)\b/i,
  /\bdraft\b.+\b(case study|follow-up)\b/i,
];

export function classifyAuthorityPermissionTier(
  proposedAction: string,
): AuthorityPermissionTier {
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

export function approvalRequiredForAuthorityTier(
  tier: AuthorityPermissionTier,
): boolean {
  return tier === "yellow" || tier === "red";
}

/** P1-AUTH-1 executes GREEN only. YELLOW/RED stay textual + blocked from execution. */
export function authorityMayExecute(proposedAction: string): boolean {
  return classifyAuthorityPermissionTier(proposedAction) === "green";
}
