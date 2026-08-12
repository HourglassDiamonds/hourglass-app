/**
 * Technical SEO / Search & GEO specialist — typed audit contracts.
 * Search Strategy capability. Audit-only. No mutation APIs.
 */

import type { Recommendation } from "../../types";
import type { SearchGeoPermissionTier } from "./permissions";

export const TECH_SEO_AUDIT_ID = "P1-TECH-1" as const;
export const TECH_SEO_AUDIT_NAME =
  "TECHNICAL SEO / GSC CLOSEOUT" as const;

export const INTENDED_CANONICAL_HOST =
  "https://www.hourglassdiamonds.com" as const;

export const TECH_SEO_VERDICTS = [
  "CLEAN",
  "CLEAN WITH MINOR ISSUES",
  "MATERIAL ISSUES FOUND",
  "BLOCKED / INSUFFICIENT EVIDENCE",
] as const;

export type TechSeoVerdict = (typeof TECH_SEO_VERDICTS)[number];

export const TECH_SEO_SEVERITIES = ["P0", "P1", "P2", "INFO"] as const;
export type TechSeoSeverity = (typeof TECH_SEO_SEVERITIES)[number];

export const TECH_SEO_AREAS = [
  "Canonical host",
  "Canonicals",
  "Sitemap",
  "Robots/indexability",
  "Redirects/404s",
  "Duplicate URL risks",
  "Structured data consistency",
  "GSC availability/gaps",
] as const;

export type TechSeoArea = (typeof TECH_SEO_AREAS)[number];

export const REQUIRED_REPORT_SECTIONS = [
  "Canonical host",
  "Canonicals",
  "Sitemap",
  "Robots/indexability",
  "Redirects/404s",
  "Duplicate URL risks",
  "Structured data consistency",
  "GSC availability/gaps",
  "Ranked next contained fixes",
] as const;

export const EVIDENCE_TABLE_COLUMNS = [
  "Area",
  "URL/file",
  "Observed state",
  "Expected state",
  "Severity",
  "Evidence",
  "Recommended action",
] as const;

export type TechSeoEvidenceRow = {
  area: TechSeoArea;
  urlOrFile: string;
  observedState: string;
  expectedState: string;
  severity: TechSeoSeverity;
  evidence: string;
  recommendedAction: string;
  permissionTier: SearchGeoPermissionTier;
  approvalRequired: boolean;
};

export type TechSeoInventoryItem = {
  path: string;
  label: string;
  kind:
    | "home"
    | "commercial"
    | "tool"
    | "editorial-hub"
    | "guide"
    | "legal"
    | "other";
  expectedInSitemap: boolean | "undeclared";
  indexIntent: "index" | "noindex" | "undeclared";
  metadataSourceFile: string | null;
};

export type LiveHttpProbeStatus =
  | "ok"
  | "redirect"
  | "not-found"
  | "error"
  | "unknown"
  | "skipped";

export type LiveHttpProbe = {
  requestUrl: string;
  finalUrl: string | null;
  status: number | null;
  probeStatus: LiveHttpProbeStatus;
  locationHeader: string | null;
  canonicalHref: string | null;
  robotsMeta: string | null;
  soft404Risk: boolean;
  notes: string[];
  error: string | null;
};

export type GscReadinessSnapshot = {
  integrationPresent: boolean;
  configured: boolean;
  siteUrlEnv: string | null;
  oauthVarsPresent: {
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
  };
  liveMetricsFetched: false;
  fabricatedMetrics: false;
  unavailableClaims: string[];
  notes: string[];
};

export type TechSeoAuditMode = "repository" | "repository+live-http";

export type TechSeoAuditOptions = {
  mode?: TechSeoAuditMode;
  liveProbe?: (url: string) => Promise<LiveHttpProbe>;
  gscConfiguredOverride?: boolean;
};

export type TechSeoCloseoutJson = {
  auditId: typeof TECH_SEO_AUDIT_ID;
  auditName: typeof TECH_SEO_AUDIT_NAME;
  originatingExecutive: "search-strategy";
  specialist: "Search & GEO / Technical SEO";
  mode: TechSeoAuditMode;
  generatedAt: string;
  intendedCanonicalHost: typeof INTENDED_CANONICAL_HOST;
  verdict: TechSeoVerdict;
  evidenceRows: TechSeoEvidenceRow[];
  liveProbes: LiveHttpProbe[];
  gscReadiness: GscReadinessSnapshot;
  inventory: TechSeoInventoryItem[];
  facts: string[];
  inferences: string[];
  evidenceGaps: string[];
  rankedNextFixes: string[];
  recommendations: Recommendation[];
};

export type TechSeoCloseoutReport = TechSeoCloseoutJson & {
  markdown: string;
};

/**
 * Forbidden mutation surface names — must never be exported from the audit core.
 * Used by containment tests.
 */
export const TECH_SEO_FORBIDDEN_EXPORT_NAMES = [
  "apply",
  "fix",
  "patch",
  "deploy",
  "writeSiteFile",
  "mutateProduction",
  "applyRedirect",
  "editMetadata",
  "editSchema",
  "editSitemap",
  "editRobots",
] as const;
