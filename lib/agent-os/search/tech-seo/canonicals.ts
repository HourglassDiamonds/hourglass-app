/**
 * Per-URL canonical metadata inspection (repository).
 */

import { articlePageMetadata } from "@/lib/seo/diamond-guide-metadata";
import { articles } from "@/app/diamond-guide/articles";
import { pageMetadata } from "@/lib/seo/site-metadata";
import type { TechSeoEvidenceRow, TechSeoInventoryItem } from "./types";
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

function extractCanonicalFromSource(text: string): string | null {
  const pathMeta = text.match(
    /pageMetadata\(\s*\{[\s\S]*?path:\s*["']([^"']+)["']/,
  );
  if (pathMeta?.[1]) return pathMeta[1];

  const alt = text.match(
    /alternates:\s*\{[\s\S]*?canonical:\s*["']([^"']+)["']/,
  );
  if (alt?.[1]) return alt[1];

  return null;
}

export function auditCanonicals(
  inventory: TechSeoInventoryItem[],
): { rows: TechSeoEvidenceRow[]; facts: string[] } {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];

  for (const item of inventory) {
    if (item.kind === "legal") {
      const source = item.metadataSourceFile
        ? readRepoText(item.metadataSourceFile)
        : null;
      const hasCanonical = source
        ? /canonical|pageMetadata|alternates/.test(source)
        : false;
      rows.push(
        row({
          area: "Canonicals",
          urlOrFile: item.path,
          observedState: hasCanonical
            ? "Canonical/metadata signals present"
            : "No page-level metadata/canonical export found",
          expectedState:
            "INTENT NOT DECLARED — do not assume index/canonical policy for legal pages",
          severity: "INFO",
          evidence:
            "Privacy/terms lack explicit indexability declaration in repository metadata",
          recommendedAction:
            "Record founder intent for privacy/terms indexability before changing metadata (YELLOW if editing)",
          permissionTier: "green",
        }),
      );
      continue;
    }

    if (item.kind === "guide") {
      const slug = item.path.replace(/^\/diamond-guide\//, "");
      const article = articles.find((a) => a.slug === slug);
      if (!article) {
        rows.push(
          row({
            area: "Canonicals",
            urlOrFile: item.path,
            observedState: "Article slug not found in articles registry",
            expectedState: "Registered guide with canonical path",
            severity: "P1",
            evidence: "Missing from app/diamond-guide/articles.ts",
            recommendedAction:
              "Verify inventory slug or restore article registry entry (YELLOW)",
            permissionTier: "yellow",
          }),
        );
        continue;
      }
      const meta = articlePageMetadata(article);
      const canonical = meta.alternates?.canonical;
      const expected = item.path;
      const ok = canonical === expected;
      facts.push(`Guide ${slug} canonical=${String(canonical)}`);
      rows.push(
        row({
          area: "Canonicals",
          urlOrFile: item.path,
          observedState: `alternates.canonical=${String(canonical)}`,
          expectedState: expected,
          severity: ok ? "INFO" : "P0",
          evidence:
            "lib/seo/diamond-guide-metadata.ts articlePageMetadata()",
          recommendedAction: ok
            ? "No action — guide canonical path verified"
            : "Align article canonical with /diamond-guide/{slug} (YELLOW)",
          permissionTier: ok ? "green" : "yellow",
        }),
      );
      continue;
    }

    // Commercial / tools / home / ledger — inspect source and helper where applicable
    if (
      item.path === "/" ||
      item.path === "/engagement-rings" ||
      item.path === "/custom-design" ||
      item.path === "/concierge"
    ) {
      const helper = pageMetadata({
        title: "probe",
        description: "probe",
        path: item.path,
      });
      const helperCanonical = helper.alternates?.canonical;
      const source = item.metadataSourceFile
        ? readRepoText(item.metadataSourceFile)
        : null;
      const sourceCanonical = source
        ? extractCanonicalFromSource(source)
        : null;
      const ok =
        helperCanonical === item.path &&
        (sourceCanonical === null || sourceCanonical === item.path);
      rows.push(
        row({
          area: "Canonicals",
          urlOrFile: item.path,
          observedState: `pageMetadata path=${String(helperCanonical)}; source=${sourceCanonical ?? "n/a"}`,
          expectedState: item.path,
          severity: ok ? "INFO" : "P0",
          evidence: `${item.metadataSourceFile ?? "n/a"} + pageMetadata()`,
          recommendedAction: ok
            ? "No action — canonical path verified"
            : "Fix pageMetadata path / alternates.canonical (YELLOW)",
          permissionTier: ok ? "green" : "yellow",
        }),
      );
      continue;
    }

    const source = item.metadataSourceFile
      ? readRepoText(item.metadataSourceFile)
      : null;
    const sourceCanonical = source ? extractCanonicalFromSource(source) : null;
    const ok = sourceCanonical === item.path;
    rows.push(
      row({
        area: "Canonicals",
        urlOrFile: item.path,
        observedState:
          sourceCanonical != null
            ? `alternates.canonical=${sourceCanonical}`
            : source
              ? "Metadata file present but canonical not parsed"
              : "Metadata source file missing",
        expectedState: item.path,
        severity: ok ? "INFO" : sourceCanonical == null ? "P1" : "P0",
        evidence: item.metadataSourceFile ?? "missing metadata source",
        recommendedAction: ok
          ? "No action — canonical path verified"
          : "Declare or fix alternates.canonical for this route (YELLOW)",
        permissionTier: ok ? "green" : "yellow",
      }),
    );
  }

  return { rows, facts };
}
