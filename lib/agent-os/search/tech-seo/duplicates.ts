/**
 * Duplicate URL / canonical cluster risks (repository).
 */

import type { TechSeoEvidenceRow } from "./types";
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

export function auditDuplicateUrlRisks(): {
  rows: TechSeoEvidenceRow[];
  facts: string[];
} {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];

  const nextConfig = readRepoText("next.config.ts") ?? "";
  const hasTrailingSlashConfig = /trailingSlash\s*:/.test(nextConfig);
  facts.push(
    hasTrailingSlashConfig
      ? "trailingSlash explicitly configured in next.config.ts"
      : "trailingSlash not explicitly set (Next default: false)",
  );

  rows.push(
    row({
      area: "Duplicate URL risks",
      urlOrFile: "next.config.ts",
      observedState: hasTrailingSlashConfig
        ? "trailingSlash configured"
        : "No trailingSlash config (default no trailing slash)",
      expectedState: "Consistent trailing-slash policy",
      severity: "INFO",
      evidence: "next.config.ts trailingSlash scan",
      recommendedAction: "No action unless live probes show slash duplicates",
      permissionTier: "green",
    }),
  );

  const redirectMatch = nextConfig.match(
    /source:\s*["']([^"']+)["'][\s\S]*?destination:\s*["']([^"']+)["'][\s\S]*?permanent:\s*(true|false)/g,
  );
  const redirects: Array<{ source: string; destination: string; permanent: string }> =
    [];
  const blockRe =
    /\{\s*source:\s*["']([^"']+)["']\s*,\s*destination:\s*["']([^"']+)["']\s*,\s*permanent:\s*(true|false)\s*,?\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(nextConfig)) !== null) {
    redirects.push({
      source: m[1]!,
      destination: m[2]!,
      permanent: m[3]!,
    });
  }

  facts.push(`Configured redirects: ${redirects.length}`);
  if (redirects.length === 0) {
    rows.push(
      row({
        area: "Duplicate URL risks",
        urlOrFile: "next.config.ts redirects()",
        observedState: "No redirects() entries parsed",
        expectedState: "Stale route names redirected when retired",
        severity: "INFO",
        evidence: redirectMatch ? "partial match noise" : "empty redirects list",
        recommendedAction: "No action from repository redirect inventory",
        permissionTier: "green",
      }),
    );
  } else {
    for (const r of redirects) {
      rows.push(
        row({
          area: "Duplicate URL risks",
          urlOrFile: r.source,
          observedState: `${r.permanent === "true" ? "301" : "302"} → ${r.destination}`,
          expectedState: "Stale routes permanently redirect to current routes",
          severity: "INFO",
          evidence: "next.config.ts redirects()",
          recommendedAction:
            "No action — documented redirect; large migrations remain RED",
          permissionTier: "green",
        }),
      );
    }
  }

  // Known old route name from docs / config
  const hasDiamondTechSuite = redirects.some(
    (r) => r.source === "/diamond-tech-suite",
  );
  rows.push(
    row({
      area: "Duplicate URL risks",
      urlOrFile: "/diamond-tech-suite",
      observedState: hasDiamondTechSuite
        ? "Permanent redirect to /diamond-studio present"
        : "No redirect rule for legacy /diamond-tech-suite",
      expectedState: "Legacy tool route does not compete with /diamond-studio",
      severity: hasDiamondTechSuite ? "INFO" : "P2",
      evidence: "next.config.ts + historical route name",
      recommendedAction: hasDiamondTechSuite
        ? "No action"
        : "Consider 301 legacy route if it still receives hits (YELLOW; confirm via GSC first)",
      permissionTier: hasDiamondTechSuite ? "green" : "yellow",
    }),
  );

  rows.push(
    row({
      area: "Duplicate URL risks",
      urlOrFile: "www vs non-www",
      observedState:
        "Repository canonical host constant is www; live host redirect not verified in repository-only mode",
      expectedState: "non-www → www (or consistent host) at edge",
      severity: "INFO",
      evidence: "Host policy is platform/DNS — not fully declared in app source",
      recommendedAction:
        "Confirm with --live-http / hosting config; do not invent edge behavior (GREEN)",
      permissionTier: "green",
    }),
  );

  rows.push(
    row({
      area: "Duplicate URL risks",
      urlOrFile: "query-state URLs",
      observedState:
        "Diamond Studio / Shape Studio use client search params; no sitemap entries for query variants",
      expectedState: "Query-state URLs remain non-indexed / canonicalized to clean tool URL",
      severity: "INFO",
      evidence: "Sitemap lists clean tool paths only; studio share params are client-side",
      recommendedAction:
        "Monitor GSC for indexed query URLs when GSC data available (GREEN)",
      permissionTier: "green",
    }),
  );

  return { rows, facts };
}
