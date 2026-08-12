/**
 * GSC integration readiness — honesty first.
 * Never fabricates coverage, indexing, impressions, clicks, positions, or query movement.
 */

import {
  getGscSiteUrl,
  isGscConfigured,
} from "@/lib/integrations/gsc";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
} from "@/lib/intelligence/env";
import type { GscReadinessSnapshot, TechSeoEvidenceRow } from "./types";
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

export function auditGscReadiness(input?: {
  configuredOverride?: boolean;
}): {
  rows: TechSeoEvidenceRow[];
  snapshot: GscReadinessSnapshot;
  facts: string[];
  evidenceGaps: string[];
} {
  const integrationPresent = true;
  const configured = input?.configuredOverride ?? isGscConfigured();
  const siteUrlEnv = getGscSiteUrl() ?? null;
  const oauth = {
    clientId: Boolean(getGoogleClientId()),
    clientSecret: Boolean(getGoogleClientSecret()),
    refreshToken: Boolean(getGoogleRefreshToken()),
  };

  const unavailableClaims = [
    "GSC coverage / indexing status",
    "impressions",
    "clicks",
    "positions",
    "query movement",
    "branded vs non-branded performance deltas",
  ];

  const evidenceGaps: string[] = [];
  const facts: string[] = [
    "GSC adapter module present: lib/integrations/gsc.ts",
    `isGscConfigured(): ${configured}`,
    `GSC_SITE_URL set: ${siteUrlEnv ? "yes" : "no"}`,
  ];

  if (!configured) {
    evidenceGaps.push(
      "Authenticated GSC data unavailable — no live Search Console metrics fetched for this audit",
    );
  } else {
    evidenceGaps.push(
      "GSC appears configured, but P1-TECH-1 V1 does not fetch live GSC metrics — coverage/indexing/query movement remain unclaimed",
    );
  }

  const snapshot: GscReadinessSnapshot = {
    integrationPresent,
    configured,
    siteUrlEnv,
    oauthVarsPresent: oauth,
    liveMetricsFetched: false,
    fabricatedMetrics: false,
    unavailableClaims,
    notes: [
      "This audit reports readiness/gaps only",
      "Zero fabricated GSC performance findings",
    ],
  };

  const rows: TechSeoEvidenceRow[] = [
    row({
      area: "GSC availability/gaps",
      urlOrFile: "lib/integrations/gsc.ts",
      observedState: "Read-only GSC integration module present",
      expectedState: "Repository GSC adapter available for Agent OS / dashboard",
      severity: "INFO",
      evidence: "Integration source exists",
      recommendedAction: "No action",
      permissionTier: "green",
    }),
    row({
      area: "GSC availability/gaps",
      urlOrFile: "GSC configuration",
      observedState: configured
        ? `Configured (site=${siteUrlEnv ?? "set"}; oauth clientId=${oauth.clientId}; secret=${oauth.clientSecret}; refresh=${oauth.refreshToken})`
        : `Not fully configured (site=${siteUrlEnv ? "set" : "missing"}; oauth clientId=${oauth.clientId}; secret=${oauth.clientSecret}; refresh=${oauth.refreshToken})`,
      expectedState:
        "GSC_SITE_URL + Google OAuth for live reads when founder enables",
      severity: "INFO",
      evidence: "Environment/config inspection only — no API metrics pulled",
      recommendedAction: configured
        ? "Optional: run a separate approved GSC analysis pass later (GREEN read)"
        : "Configure GSC credentials if live Search Console analysis is desired (GREEN config outside this module)",
      permissionTier: "green",
    }),
    row({
      area: "GSC availability/gaps",
      urlOrFile: "Live GSC metrics",
      observedState:
        "NOT FETCHED — liveMetricsFetched=false; fabricatedMetrics=false",
      expectedState:
        "Do not invent coverage, indexing state, impressions, clicks, positions, or query movement",
      severity: "INFO",
      evidence: unavailableClaims.map((c) => `unavailable: ${c}`).join("; "),
      recommendedAction:
        "Treat all GSC performance claims as evidence gaps until a verified export/API read is supplied (GREEN)",
      permissionTier: "green",
    }),
  ];

  return { rows, snapshot, facts, evidenceGaps };
}
