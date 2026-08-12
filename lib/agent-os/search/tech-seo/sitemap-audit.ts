/**
 * Sitemap implementation / coverage audit (repository reconstruction).
 */

import { articles } from "@/app/diamond-guide/articles";
import { LEDGER_INDEXES } from "@/app/ledger/ledger-data";
import {
  episodePath,
  getPublishedEpisodes,
  isConversationsHubPublic,
} from "@/lib/conversations/episodes";
import { DIAMOND_GUIDE_CATEGORIES } from "@/lib/seo/diamond-guide-metadata";
import { SITE_URL } from "@/lib/seo/site-metadata";
import type { TechSeoEvidenceRow, TechSeoInventoryItem } from "./types";
import { readRepoText, repoFileExists } from "./repo-read";
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

/** Reconstruct paths emitted by app/sitemap.ts (read-only mirror). */
export function reconstructSitemapPaths(): {
  paths: string[];
  sources: string[];
} {
  const sources = ["app/sitemap.ts"];
  const paths = new Set<string>();

  const core = [
    "/",
    "/the-house",
    "/our-approach",
    "/engagement-rings",
    "/custom-design",
    "/concierge",
    "/diamond-studio",
    "/diamond-shape-studio",
    "/diamond-intelligence",
    "/diamond-guide",
    "/whispered-praise",
    "/ledger",
  ];
  for (const p of core) paths.add(p);

  if (isConversationsHubPublic()) {
    paths.add("/conversations");
  }

  for (const index of LEDGER_INDEXES) {
    paths.add(`/ledger/${index.slug}`);
  }

  for (const category of DIAMOND_GUIDE_CATEGORIES) {
    paths.add(`/diamond-guide/${category.segment}`);
    paths.add(`/diamond-guide/${category.segment}/all`);
  }

  for (const article of articles) {
    paths.add(`/diamond-guide/${article.slug}`);
  }

  for (const episode of getPublishedEpisodes()) {
    paths.add(episodePath(episode.slug));
  }

  return { paths: [...paths].sort(), sources };
}

export function auditSitemap(
  inventory: TechSeoInventoryItem[],
): { rows: TechSeoEvidenceRow[]; facts: string[] } {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];

  const sitemapExists = repoFileExists("app/sitemap.ts");
  const robotsText = readRepoText("app/robots.ts") ?? "";
  const pointsToSitemap = /sitemap\.xml|SITE_URL.*sitemap/.test(robotsText);

  rows.push(
    row({
      area: "Sitemap",
      urlOrFile: "app/sitemap.ts",
      observedState: sitemapExists
        ? "Next MetadataRoute sitemap implementation present"
        : "Missing",
      expectedState: "Single authoritative app/sitemap.ts",
      severity: sitemapExists ? "INFO" : "P0",
      evidence: sitemapExists
        ? "Primary sitemap source located"
        : "No app/sitemap.ts",
      recommendedAction: sitemapExists
        ? "No action — sitemap implementation identified"
        : "Restore sitemap route module (YELLOW)",
      permissionTier: sitemapExists ? "green" : "yellow",
    }),
  );

  // Secondary sitemap sources (e.g. public/sitemap.xml) — flag if present
  const publicSitemap = repoFileExists("public/sitemap.xml");
  rows.push(
    row({
      area: "Sitemap",
      urlOrFile: "public/sitemap.xml",
      observedState: publicSitemap
        ? "Static public/sitemap.xml also present"
        : "No static public/sitemap.xml",
      expectedState: "Prefer single Next app/sitemap.ts source",
      severity: publicSitemap ? "P2" : "INFO",
      evidence: publicSitemap
        ? "Multiple sitemap implementations may confuse crawlers"
        : "Only app/sitemap.ts observed as implementation",
      recommendedAction: publicSitemap
        ? "Review whether static sitemap should be removed (YELLOW)"
        : "No action",
      permissionTier: publicSitemap ? "yellow" : "green",
    }),
  );

  rows.push(
    row({
      area: "Sitemap",
      urlOrFile: "app/robots.ts",
      observedState: pointsToSitemap
        ? `robots references sitemap via SITE_URL (${SITE_URL}/sitemap.xml)`
        : "robots sitemap reference unclear",
      expectedState: "robots.txt points at www sitemap.xml",
      severity: pointsToSitemap ? "INFO" : "P1",
      evidence: "robots.ts sitemap field",
      recommendedAction: pointsToSitemap
        ? "No action"
        : "Ensure robots sitemap URL is correct (YELLOW)",
      permissionTier: pointsToSitemap ? "green" : "yellow",
    }),
  );

  const { paths, sources } = reconstructSitemapPaths();
  facts.push(
    `Reconstructed sitemap path count: ${paths.length} from ${sources.join(", ")}`,
  );

  for (const item of inventory) {
    const inSitemap = paths.includes(item.path);

    if (item.expectedInSitemap === "undeclared") {
      rows.push(
        row({
          area: "Sitemap",
          urlOrFile: item.path,
          observedState: inSitemap
            ? "Present in reconstructed sitemap"
            : "Absent from reconstructed sitemap",
          expectedState:
            "INTENT NOT DECLARED — privacy/terms sitemap inclusion not presumed",
          severity: "INFO",
          evidence:
            "No explicit repository policy declaring legal-page sitemap intent",
          recommendedAction:
            "Decide founder intent for privacy/terms sitemap inclusion before changes (YELLOW if editing sitemap)",
          permissionTier: "green",
        }),
      );
      continue;
    }

    if (item.expectedInSitemap === true) {
      rows.push(
        row({
          area: "Sitemap",
          urlOrFile: item.path,
          observedState: inSitemap
            ? "Present in reconstructed sitemap"
            : "OMITTED from reconstructed sitemap",
          expectedState: "Included (major indexable commercial/editorial/tool)",
          severity: inSitemap ? "INFO" : "P1",
          evidence: inSitemap
            ? "Matched core/guide sitemap reconstruction"
            : "Expected indexable URL missing from app/sitemap.ts reconstruction",
          recommendedAction: inSitemap
            ? "No action"
            : "Add URL to sitemap if still indexable (YELLOW)",
          permissionTier: inSitemap ? "green" : "yellow",
        }),
      );
      continue;
    }

    // expectedInSitemap === false
    rows.push(
      row({
        area: "Sitemap",
        urlOrFile: item.path,
        observedState: inSitemap
          ? "Present but inventory marks not expected"
          : "Absent (as expected)",
        expectedState: "Not listed",
        severity: inSitemap ? "P2" : "INFO",
        evidence: "Inventory expectedInSitemap=false",
        recommendedAction: inSitemap
          ? "Review sitemap inclusion (YELLOW)"
          : "No action",
        permissionTier: inSitemap ? "yellow" : "green",
      }),
    );
  }

  return { rows, facts };
}
