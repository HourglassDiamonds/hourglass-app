/**
 * P1-TECH-1 Technical SEO / GSC closeout — audit orchestration.
 * Standalone Search Strategy specialist workflow. Does NOT mutate the site.
 */

import { auditCanonicalHost } from "./canonical-host";
import { auditCanonicals } from "./canonicals";
import { auditDuplicateUrlRisks } from "./duplicates";
import { auditGscReadiness } from "./gsc-readiness";
import { auditHttpIndexability } from "./http-indexability";
import { buildP1Tech1Inventory } from "./inventory";
import { recommendationsFromEvidenceRows } from "./recommendations";
import {
  buildRankedNextFixes,
  computeVerdict,
  formatTechSeoMarkdown,
} from "./report";
import { auditRobotsAndNoindex } from "./robots-audit";
import { auditStructuredDataConsistency } from "./schema-consistency";
import { auditSitemap } from "./sitemap-audit";
import {
  INTENDED_CANONICAL_HOST,
  TECH_SEO_AUDIT_ID,
  TECH_SEO_AUDIT_NAME,
  type TechSeoAuditOptions,
  type TechSeoCloseoutJson,
  type TechSeoCloseoutReport,
  type TechSeoEvidenceRow,
} from "./types";

function todayPeriod(): { start: string; end: string } {
  const d = new Date().toISOString().slice(0, 10);
  return { start: d, end: d };
}

export async function runP1Tech1Closeout(
  options: TechSeoAuditOptions = {},
): Promise<TechSeoCloseoutReport> {
  const mode = options.mode ?? "repository";
  const liveHttp = mode === "repository+live-http";
  const inventory = buildP1Tech1Inventory();

  const facts: string[] = [];
  const inferences: string[] = [];
  const evidenceGaps: string[] = [];
  const evidenceRows: TechSeoEvidenceRow[] = [];

  const host = auditCanonicalHost();
  evidenceRows.push(...host.rows);
  facts.push(...host.facts);

  const canonicals = auditCanonicals(inventory);
  evidenceRows.push(...canonicals.rows);
  facts.push(...canonicals.facts);

  const sitemap = auditSitemap(inventory);
  evidenceRows.push(...sitemap.rows);
  facts.push(...sitemap.facts);

  const robots = auditRobotsAndNoindex();
  evidenceRows.push(...robots.rows);
  facts.push(...robots.facts);

  const http = await auditHttpIndexability({
    inventory,
    liveHttp,
    probe: options.liveProbe,
  });
  evidenceRows.push(...http.rows);
  facts.push(...http.facts);
  evidenceGaps.push(...http.evidenceGaps);

  const dupes = auditDuplicateUrlRisks();
  evidenceRows.push(...dupes.rows);
  facts.push(...dupes.facts);

  const schema = auditStructuredDataConsistency();
  evidenceRows.push(...schema.rows);
  facts.push(...schema.facts);

  const gsc = auditGscReadiness({
    configuredOverride: options.gscConfiguredOverride,
  });
  evidenceRows.push(...gsc.rows);
  facts.push(...gsc.facts);
  evidenceGaps.push(...gsc.evidenceGaps);

  inferences.push(
    "Repository-declared canonical paths are assumed to resolve via Next metadataBase to the www host",
  );
  if (!liveHttp) {
    inferences.push(
      "Production HTTP status and live canonical tags were not observed in repository-only mode",
    );
  }

  const verdict = computeVerdict(evidenceRows, evidenceGaps, liveHttp);
  const rankedNextFixes = buildRankedNextFixes(evidenceRows);
  const recommendations = recommendationsFromEvidenceRows(
    evidenceRows,
    todayPeriod(),
  );

  const json: TechSeoCloseoutJson = {
    auditId: TECH_SEO_AUDIT_ID,
    auditName: TECH_SEO_AUDIT_NAME,
    originatingExecutive: "search-strategy",
    specialist: "Search & GEO / Technical SEO",
    mode,
    generatedAt: new Date().toISOString(),
    intendedCanonicalHost: INTENDED_CANONICAL_HOST,
    verdict,
    evidenceRows,
    liveProbes: http.probes,
    gscReadiness: gsc.snapshot,
    inventory,
    facts,
    inferences,
    evidenceGaps,
    rankedNextFixes,
    recommendations,
  };

  const markdown = formatTechSeoMarkdown(json);
  return { ...json, markdown };
}
