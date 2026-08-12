/**
 * GREEN / YELLOW / RED mapping over Agent OS V1 permission primitives.
 * Not a second security system — thin specialist vocabulary.
 */

import {
  isActionProhibited,
  proposedActionImpliesWrite,
} from "../../permissions";
import type { ProhibitedAction } from "../../types";
import { V1_PROHIBITED_ACTIONS } from "../../types";

export type SearchGeoPermissionTier = "green" | "yellow" | "red";

/** Actions this specialist may perform autonomously (inspect / report / recommend). */
export const SEARCH_GEO_GREEN_CAPABILITIES = [
  "inspect-repository",
  "run-tests",
  "inspect-html-schema-sitemaps",
  "audit-urls",
  "analyze-supplied-gsc-exports",
  "analyze-local-falcon-reports",
  "analyze-public-search-evidence",
  "create-audit-reports",
  "compare-historical-benchmarks",
  "identify-regressions",
  "draft-recommendations",
  "prepare-proposed-changes-without-applying",
] as const;

/** Proposed site changes — textual only; approvalRequired; no apply path. */
export const SEARCH_GEO_YELLOW_CAPABILITIES = [
  "edit-seo-metadata",
  "edit-schema",
  "change-sitemap-behavior",
  "change-robots-directives",
  "add-or-remove-redirects",
  "alter-internal-linking",
  "modify-local-entity-nap-implementation",
  "publish-or-revise-search-targeted-content",
] as const;

/** Prohibited operational actions — no execution path in this module. */
export const SEARCH_GEO_RED_CAPABILITIES = [
  "production-deployment",
  "deletion-of-indexed-content",
  "large-redirect-migrations",
  "change-canonical-business-identity-or-address",
  "gbp-changes",
  "external-outreach-contact",
  "paid-placements-spending",
  "materially-alter-public-business-information",
] as const;

const YELLOW_ACTION_PATTERNS: RegExp[] = [
  /\b(edit|update|change|add|remove|alter)\b.*\b(metadata|canonical|schema|sitemap|robots|redirect|internal.?link|nap|noindex)\b/i,
  /\bpublish\b.*\b(content|page|article)\b/i,
  /\brevise\b.*\b(content|copy|page)\b/i,
];

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bdeploy\b/i,
  /\bpush\b.*\b(production|vercel|main)\b/i,
  /\bdelete\b.*\b(indexed|page|url|content)\b/i,
  /\bmigrat(e|ion)\b.*\bredirect/i,
  /\bedit gbp\b/i,
  /\boutreach\b/i,
  /\bpurchase\b|\bspend\b|\bbuy ads\b/i,
  /\bchange\b.*\b(address|identity|nap)\b/i,
];

export function classifySearchGeoPermissionTier(
  proposedAction: string,
): SearchGeoPermissionTier {
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

export function approvalRequiredForTier(
  tier: SearchGeoPermissionTier,
): boolean {
  return tier === "yellow" || tier === "red";
}

/** RED tiers have no execution path — recommendations stay textual + blocked. */
export function recommendationStatusForTier(
  tier: SearchGeoPermissionTier,
): "proposed" | "blocked" {
  if (tier === "red") return "blocked";
  return "proposed";
}

export function assertNoRedExecutionPath(action: string): void {
  const tier = classifySearchGeoPermissionTier(action);
  if (tier === "red") {
    throw new Error(
      `Search & GEO RED action has no execution path: ${action}`,
    );
  }
}

export function searchGeoMapsOntoV1Prohibitions(): readonly ProhibitedAction[] {
  return V1_PROHIBITED_ACTIONS;
}
