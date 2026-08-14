/**
 * GREEN / YELLOW / RED vocabulary for Website QA.
 * Thin specialist mapping — not a second security system.
 * P1-QA-1 executes GREEN only. No automatic fix/deploy.
 */

import {
  isActionProhibited,
  proposedActionImpliesWrite,
} from "../../permissions";

export type WebsiteQaPermissionTier = "green" | "yellow" | "red";

export const WEBSITE_QA_GREEN_CAPABILITIES = [
  "http-read",
  "read-analytics-evidence",
  "run-tests",
  "inspect-repo-state",
  "report-production-health",
  "identify-regression",
  "propose-contained-fix",
] as const;

export const WEBSITE_QA_YELLOW_CAPABILITIES = [
  "prepare-source-changes",
  "prepare-repair-plan",
] as const;

export const WEBSITE_QA_RED_CAPABILITIES = [
  "modify-production",
  "production-deployment",
  "change-analytics-configuration",
  "delete-content",
  "spend-money",
  "mutate-external-systems",
] as const;

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bdeploy\b/i,
  /\bpush\b.+\b(production|vercel|main)\b/i,
  /\bdelete\b/i,
  /\bspend\b|\bpurchase\b/i,
  /\bmutate\b.+\b(crm|analytics|production)\b/i,
];

const YELLOW_ACTION_PATTERNS: RegExp[] = [
  /\bprepare\b.+\b(fix|repair|source change|patch)\b/i,
  /\bdraft\b.+\b(repair|patch)\b/i,
];

export function classifyWebsiteQaPermissionTier(
  proposedAction: string,
): WebsiteQaPermissionTier {
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

/** P1-QA-1 executes GREEN only. */
export function websiteQaMayExecute(proposedAction: string): boolean {
  return classifyWebsiteQaPermissionTier(proposedAction) === "green";
}
