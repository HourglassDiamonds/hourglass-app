/**
 * Structured data URL / entity consistency (narrow — no NAP/a11y redo).
 */

import {
  absoluteUrl,
  DIAMOND_INTELLIGENCE_APP_ID,
  DIAMOND_SHAPE_STUDIO_APP_ID,
  DIAMOND_STUDIO_APP_ID,
  JEWELRY_STORE_ID,
  ORGANIZATION_ID,
  PERSON_ID,
  WEBSITE_ID,
} from "@/lib/seo/schema/constants";
import { INTENDED_CANONICAL_HOST, type TechSeoEvidenceRow } from "./types";
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

export function auditStructuredDataConsistency(): {
  rows: TechSeoEvidenceRow[];
  facts: string[];
} {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];

  const ids = [
    { name: "Organization", id: ORGANIZATION_ID },
    { name: "Person (Justin Smith)", id: PERSON_ID },
    { name: "WebSite", id: WEBSITE_ID },
    { name: "JewelryStore", id: JEWELRY_STORE_ID },
    { name: "Diamond Studio SoftwareApplication", id: DIAMOND_STUDIO_APP_ID },
    {
      name: "Diamond Intelligence SoftwareApplication",
      id: DIAMOND_INTELLIGENCE_APP_ID,
    },
    {
      name: "Shape Studio SoftwareApplication",
      id: DIAMOND_SHAPE_STUDIO_APP_ID,
    },
  ];

  for (const entry of ids) {
    const onWww = entry.id.startsWith(INTENDED_CANONICAL_HOST);
    facts.push(`${entry.name} @id=${entry.id}`);
    rows.push(
      row({
        area: "Structured data consistency",
        urlOrFile: "lib/seo/schema/constants.ts",
        observedState: `${entry.name} @id=${entry.id}`,
        expectedState: `@id on ${INTENDED_CANONICAL_HOST}`,
        severity: onWww ? "INFO" : "P1",
        evidence: "Schema entity identity constants",
        recommendedAction: onWww
          ? "No action — entity @id uses www host"
          : "Align schema @id host with www canonical (YELLOW)",
        permissionTier: onWww ? "green" : "yellow",
      }),
    );
  }

  const toolUrls = [
    absoluteUrl("/"),
    absoluteUrl("/diamond-studio"),
    absoluteUrl("/diamond-intelligence"),
    absoluteUrl("/diamond-shape-studio"),
    absoluteUrl("/concierge"),
  ];
  for (const url of toolUrls) {
    const ok = url.startsWith(INTENDED_CANONICAL_HOST);
    rows.push(
      row({
        area: "Structured data consistency",
        urlOrFile: url,
        observedState: `absoluteUrl → ${url}`,
        expectedState: `www absolute URL`,
        severity: ok ? "INFO" : "P1",
        evidence: "lib/seo/schema/constants.ts absoluteUrl()",
        recommendedAction: ok
          ? "No action"
          : "Fix absoluteUrl host (YELLOW)",
        permissionTier: ok ? "green" : "yellow",
      }),
    );
  }

  // Website @id quirk: WEBSITE_ID = `${SITE_URL}#website` (no slash before hash)
  const websiteIdHasPathSlash = WEBSITE_ID.includes("/#website");
  rows.push(
    row({
      area: "Structured data consistency",
      urlOrFile: WEBSITE_ID,
      observedState: websiteIdHasPathSlash
        ? "WebSite @id uses /#website"
        : `WebSite @id=${WEBSITE_ID} (hash directly on origin)`,
      expectedState:
        "Stable single WebSite @id; Organization/Person remain distinct from founder entity",
      severity: "INFO",
      evidence:
        "Documented constant form — not treated as NAP work; flag only for awareness",
      recommendedAction:
        "No NAP redo; optionally normalize WebSite @id in a future approved edit (YELLOW if changing)",
      permissionTier: "green",
    }),
  );

  rows.push(
    row({
      area: "Structured data consistency",
      urlOrFile: "Organization vs Person",
      observedState:
        "Distinct ORGANIZATION_ID and PERSON_ID constants (Hourglass vs Justin Smith)",
      expectedState:
        "Business authority and founder/expert authority remain distinct entities",
      severity: "INFO",
      evidence: "lib/seo/schema/constants.ts",
      recommendedAction: "No action — entity separation preserved",
      permissionTier: "green",
    }),
  );

  return { rows, facts };
}
