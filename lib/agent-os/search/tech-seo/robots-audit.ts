/**
 * Robots.txt + noindex / robots metadata conflict scan (repository).
 */

import type { TechSeoEvidenceRow } from "./types";
import { readRepoText, scanRepoForPatterns } from "./repo-read";
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

export function auditRobotsAndNoindex(): {
  rows: TechSeoEvidenceRow[];
  facts: string[];
} {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];

  const robotsSrc = readRepoText("app/robots.ts") ?? "";
  const allowsAll = /allow:\s*["']\/["']/.test(robotsSrc);
  const hasDisallow = /disallow:/i.test(robotsSrc);

  rows.push(
    row({
      area: "Robots/indexability",
      urlOrFile: "app/robots.ts",
      observedState: allowsAll
        ? `Allow "/"${hasDisallow ? " + Disallow rules present" : "; no Disallow rules"}`
        : "Allow '/' not found",
      expectedState: "Explicit robots generation with intentional allow/disallow",
      severity: allowsAll ? "INFO" : "P1",
      evidence: "app/robots.ts MetadataRoute.Robots",
      recommendedAction: allowsAll
        ? "No action — robots allow-all verified"
        : "Review robots allow rules (YELLOW)",
      permissionTier: allowsAll ? "green" : "yellow",
    }),
  );

  const noindexHits = scanRepoForPatterns({
    roots: ["app", "lib/seo"],
    extensions: [".ts", ".tsx"],
    patterns: [
      /\bnoindex\b/i,
      /robots:\s*\{[^}]*index:\s*false/i,
      /robots:\s*\{[^}]*follow:\s*false/i,
    ],
    maxFiles: 500,
  });

  facts.push(`noindex/robots metadata hits: ${noindexHits.length} files`);

  // Known intentional noindex surfaces
  const intentional = noindexHits.filter(
    (h) =>
      h.file.includes("executive-dashboard") ||
      h.file.includes("calibration-library") ||
      h.file.includes("conversations"),
  );
  const other = noindexHits.filter((h) => !intentional.includes(h));

  for (const hit of intentional.slice(0, 6)) {
    rows.push(
      row({
        area: "Robots/indexability",
        urlOrFile: hit.file,
        observedState: `Intentional noindex/robots signal: ${hit.matches[0] ?? "match"}`,
        expectedState: "noindex on non-public / draft / internal surfaces",
        severity: "INFO",
        evidence: hit.matches.join(" | "),
        recommendedAction: "No action — appears intentional for non-public surface",
        permissionTier: "green",
      }),
    );
  }

  if (other.length === 0) {
    rows.push(
      row({
        area: "Robots/indexability",
        urlOrFile: "app/ + lib/seo/ scan",
        observedState:
          "No unexpected noindex/robots:index:false hits on public commercial inventory paths",
        expectedState: "No accidental noindex on commercial/tool pages",
        severity: "INFO",
        evidence: `Scanned for noindex / robots index:false; intentional hits=${intentional.length}`,
        recommendedAction: "No action",
        permissionTier: "green",
      }),
    );
  } else {
    for (const hit of other.slice(0, 10)) {
      rows.push(
        row({
          area: "Robots/indexability",
          urlOrFile: hit.file,
          observedState: `Possible robots/noindex signal: ${hit.matches[0] ?? "match"}`,
          expectedState: "Confirm intentional; no accidental block of commercial URLs",
          severity: "P1",
          evidence: hit.matches.join(" | "),
          recommendedAction:
            "Verify whether this noindex is intentional (YELLOW if changing)",
          permissionTier: "yellow",
        }),
      );
    }
  }

  // Canonical keyword conflicts (informational scan)
  const canonicalHits = scanRepoForPatterns({
    roots: ["app"],
    extensions: [".ts", ".tsx"],
    patterns: [/rel=["']canonical["']/i, /alternates:\s*\{[\s\S]*?canonical:/],
    maxFiles: 300,
  });
  facts.push(`canonical declaration files under app/: ${canonicalHits.length}`);

  return { rows, facts };
}
