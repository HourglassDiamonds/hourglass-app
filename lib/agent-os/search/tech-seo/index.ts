/**
 * Search & GEO / Technical SEO specialist — public audit API.
 *
 * Standalone under Search Strategy. NOT wired into runSearchStrategy() in V1.
 * Audit-only: inspection + report data. No apply/fix/patch/deploy exports.
 *
 * Filesystem writes live in ./write-artifacts.ts and are intentionally
 * NOT re-exported here — only the CLI should import the writer.
 */

export {
  TECH_SEO_AUDIT_ID,
  TECH_SEO_AUDIT_NAME,
  INTENDED_CANONICAL_HOST,
  TECH_SEO_VERDICTS,
  TECH_SEO_SEVERITIES,
  TECH_SEO_AREAS,
  REQUIRED_REPORT_SECTIONS,
  EVIDENCE_TABLE_COLUMNS,
  TECH_SEO_FORBIDDEN_EXPORT_NAMES,
  type TechSeoVerdict,
  type TechSeoSeverity,
  type TechSeoArea,
  type TechSeoEvidenceRow,
  type TechSeoInventoryItem,
  type LiveHttpProbe,
  type LiveHttpProbeStatus,
  type GscReadinessSnapshot,
  type TechSeoAuditMode,
  type TechSeoAuditOptions,
  type TechSeoCloseoutJson,
  type TechSeoCloseoutReport,
} from "./types";

export {
  SEARCH_GEO_GREEN_CAPABILITIES,
  SEARCH_GEO_YELLOW_CAPABILITIES,
  SEARCH_GEO_RED_CAPABILITIES,
  classifySearchGeoPermissionTier,
  approvalRequiredForTier,
  recommendationStatusForTier,
  assertNoRedExecutionPath,
  searchGeoMapsOntoV1Prohibitions,
  type SearchGeoPermissionTier,
} from "./permissions";

export {
  buildP1Tech1Inventory,
  REPRESENTATIVE_GUIDE_SLUGS,
} from "./inventory";

export { runP1Tech1Closeout } from "./run-p1-tech-1";

export {
  formatTechSeoMarkdown,
  formatEvidenceTable,
  computeVerdict,
  buildRankedNextFixes,
  assertReportContract,
} from "./report";

export {
  absoluteInventoryUrl,
  defaultLiveHttpProbe,
  skippedLiveProbe,
} from "./http-indexability";

export { reconstructSitemapPaths } from "./sitemap-audit";
