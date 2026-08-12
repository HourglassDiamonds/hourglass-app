/**
 * Canonical host audit — repository evidence only.
 */

import { SITE_URL } from "@/lib/seo/site-metadata";
import {
  INTENDED_CANONICAL_HOST,
  type TechSeoEvidenceRow,
} from "./types";
import { readRepoText } from "./repo-read";
import {
  approvalRequiredForTier,
  classifySearchGeoPermissionTier,
} from "./permissions";

function row(
  partial: Omit<TechSeoEvidenceRow, "permissionTier" | "approvalRequired"> & {
    permissionTier?: TechSeoEvidenceRow["permissionTier"];
  },
): TechSeoEvidenceRow {
  const tier =
    partial.permissionTier ??
    classifySearchGeoPermissionTier(partial.recommendedAction);
  return {
    ...partial,
    permissionTier: tier,
    approvalRequired: approvalRequiredForTier(tier),
  };
}

export function auditCanonicalHost(): {
  rows: TechSeoEvidenceRow[];
  facts: string[];
} {
  const facts: string[] = [];
  const rows: TechSeoEvidenceRow[] = [];

  facts.push(`Intended canonical host: ${INTENDED_CANONICAL_HOST}`);
  facts.push(`lib/seo/site-metadata.ts SITE_URL: ${SITE_URL}`);

  const siteMetaOk = SITE_URL === INTENDED_CANONICAL_HOST;
  rows.push(
    row({
      area: "Canonical host",
      urlOrFile: "lib/seo/site-metadata.ts",
      observedState: `SITE_URL=${SITE_URL}`,
      expectedState: INTENDED_CANONICAL_HOST,
      severity: siteMetaOk ? "INFO" : "P0",
      evidence: siteMetaOk
        ? "SITE_URL matches intended www host"
        : "SITE_URL differs from intended canonical host",
      recommendedAction: siteMetaOk
        ? "No action — canonical host constant verified"
        : "Align SITE_URL with https://www.hourglassdiamonds.com (YELLOW — approval required before edit)",
      permissionTier: siteMetaOk ? "green" : "yellow",
    }),
  );

  const layout = readRepoText("app/layout.tsx") ?? "";
  const hasMetadataBase = /metadataBase:\s*new URL\(SITE_URL\)/.test(layout);
  rows.push(
    row({
      area: "Canonical host",
      urlOrFile: "app/layout.tsx",
      observedState: hasMetadataBase
        ? "metadataBase: new URL(SITE_URL)"
        : "metadataBase SITE_URL binding not found",
      expectedState: "metadataBase bound to SITE_URL (www host)",
      severity: hasMetadataBase ? "INFO" : "P1",
      evidence: hasMetadataBase
        ? "Root layout binds metadataBase to SITE_URL"
        : "Could not confirm metadataBase → SITE_URL",
      recommendedAction: hasMetadataBase
        ? "No action — metadataBase verified"
        : "Confirm metadataBase uses SITE_URL (YELLOW)",
      permissionTier: hasMetadataBase ? "green" : "yellow",
    }),
  );

  const robots = readRepoText("app/robots.ts") ?? "";
  const sitemap = readRepoText("app/sitemap.ts") ?? "";
  const robotsUsesSiteUrl = /SITE_URL/.test(robots);
  const sitemapUsesSiteUrl = /SITE_URL/.test(sitemap);

  rows.push(
    row({
      area: "Canonical host",
      urlOrFile: "app/robots.ts",
      observedState: robotsUsesSiteUrl
        ? "sitemap URL built from SITE_URL"
        : "SITE_URL not referenced",
      expectedState: "robots sitemap points at www host",
      severity: robotsUsesSiteUrl ? "INFO" : "P1",
      evidence: robotsUsesSiteUrl
        ? "robots.ts imports/uses SITE_URL"
        : "robots.ts does not reference SITE_URL",
      recommendedAction: robotsUsesSiteUrl
        ? "No action"
        : "Point robots sitemap to www host via SITE_URL (YELLOW)",
      permissionTier: robotsUsesSiteUrl ? "green" : "yellow",
    }),
  );

  rows.push(
    row({
      area: "Canonical host",
      urlOrFile: "app/sitemap.ts",
      observedState: sitemapUsesSiteUrl
        ? "URLs built from SITE_URL"
        : "SITE_URL not referenced",
      expectedState: "sitemap URLs use www host",
      severity: sitemapUsesSiteUrl ? "INFO" : "P1",
      evidence: sitemapUsesSiteUrl
        ? "sitemap.ts imports/uses SITE_URL"
        : "sitemap.ts does not reference SITE_URL",
      recommendedAction: sitemapUsesSiteUrl
        ? "No action"
        : "Build sitemap URLs from SITE_URL (YELLOW)",
      permissionTier: sitemapUsesSiteUrl ? "green" : "yellow",
    }),
  );

  // Conflicting host literals (non-www or alternate hosts) in SEO-critical files
  const hostScanTargets = [
    "lib/seo/site-metadata.ts",
    "lib/seo/schema/constants.ts",
    "app/layout.tsx",
    "app/robots.ts",
    "app/sitemap.ts",
  ];
  const conflicting: string[] = [];
  for (const file of hostScanTargets) {
    const text = readRepoText(file);
    if (!text) continue;
    if (/https?:\/\/hourglassdiamonds\.com(?!\/)/.test(text) &&
      !/www\.hourglassdiamonds\.com/.test(
        text.match(/https?:\/\/hourglassdiamonds\.com[^\s"'`]*/)?.[0] ?? "",
      )) {
      // bare non-www absolute host
      if (/https?:\/\/hourglassdiamonds\.com(\/|"|'|`|\s|$)/.test(text)) {
        const bare = text.match(/https?:\/\/hourglassdiamonds\.com/g);
        if (bare) {
          for (const b of bare) {
            if (!b.includes("www.")) {
              conflicting.push(`${file}: ${b}`);
            }
          }
        }
      }
    }
    if (/https?:\/\/(?!www\.)[a-z0-9.-]*hourglass[a-z0-9.-]*/i.test(text)) {
      const m = text.match(
        /https?:\/\/(?!www\.)[a-z0-9.-]*hourglass[a-z0-9.-]*/gi,
      );
      if (m) {
        for (const hit of m) {
          if (hit !== INTENDED_CANONICAL_HOST && !hit.startsWith(INTENDED_CANONICAL_HOST)) {
            conflicting.push(`${file}: ${hit}`);
          }
        }
      }
    }
  }

  const uniqueConflicts = [...new Set(conflicting)];
  rows.push(
    row({
      area: "Canonical host",
      urlOrFile: "SEO-critical host scan",
      observedState:
        uniqueConflicts.length === 0
          ? "No conflicting non-www hourglass host literals in scanned SEO files"
          : `Possible conflicts: ${uniqueConflicts.slice(0, 5).join("; ")}`,
      expectedState: "Only www.hourglassdiamonds.com as canonical host",
      severity: uniqueConflicts.length === 0 ? "INFO" : "P1",
      evidence:
        uniqueConflicts.length === 0
          ? "Scanned site-metadata, schema constants, layout, robots, sitemap"
          : uniqueConflicts.join(" | "),
      recommendedAction:
        uniqueConflicts.length === 0
          ? "No action"
          : "Review conflicting host literals; keep www canonical (YELLOW)",
      permissionTier: uniqueConflicts.length === 0 ? "green" : "yellow",
    }),
  );

  return { rows, facts };
}
