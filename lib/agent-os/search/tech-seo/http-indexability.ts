/**
 * Optional read-only live HTTP probes against production.
 * Failures degrade to UNKNOWN — never fabricate indexability claims.
 */

import { INTENDED_CANONICAL_HOST, type LiveHttpProbe } from "./types";
import type { TechSeoEvidenceRow, TechSeoInventoryItem } from "./types";
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

export function absoluteInventoryUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${INTENDED_CANONICAL_HOST}/`;
  return `${INTENDED_CANONICAL_HOST}${normalized}`;
}

function extractCanonical(html: string): string | null {
  const m =
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    );
  return m?.[1] ?? null;
}

function extractRobotsMeta(html: string): string | null {
  const m =
    html.match(
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']robots["']/i,
    );
  return m?.[1] ?? null;
}

function soft404Risk(status: number | null, html: string | null): boolean {
  if (status === 404 || status === 410) return false;
  if (!html || status == null || status >= 400) return false;
  const lower = html.toLowerCase();
  const title404 = /<title>[^<]*404[^<]*<\/title>/.test(lower);
  const bodyNotFound =
    /page not found|doesn'?t exist|we couldn'?t find/i.test(lower) &&
    html.length < 8000;
  return title404 || bodyNotFound;
}

export async function defaultLiveHttpProbe(
  url: string,
): Promise<LiveHttpProbe> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "HourglassAgentOsTechSeoAudit/1.0 (+read-only)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const location = res.headers.get("location");
    const status = res.status;
    let html: string | null = null;
    let finalUrl: string | null = url;
    let probeStatus: LiveHttpProbe["probeStatus"] = "ok";

    if (status >= 300 && status < 400) {
      probeStatus = "redirect";
      finalUrl = location
        ? location.startsWith("http")
          ? location
          : new URL(location, url).toString()
        : null;
    } else if (status === 404 || status === 410) {
      probeStatus = "not-found";
    } else if (status >= 400) {
      probeStatus = "error";
    }

    if (status >= 200 && status < 300) {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/html") || ct.includes("application/xhtml")) {
        html = await res.text();
      }
    }

    return {
      requestUrl: url,
      finalUrl,
      status,
      probeStatus,
      locationHeader: location,
      canonicalHref: html ? extractCanonical(html) : null,
      robotsMeta: html ? extractRobotsMeta(html) : null,
      soft404Risk: soft404Risk(status, html),
      notes: [
        `HTTP ${status}`,
        location ? `Location: ${location}` : "No Location header",
      ],
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      requestUrl: url,
      finalUrl: null,
      status: null,
      probeStatus: "unknown",
      locationHeader: null,
      canonicalHref: null,
      robotsMeta: null,
      soft404Risk: false,
      notes: ["Live probe failed — treated as UNKNOWN / INSUFFICIENT EVIDENCE"],
      error: message.slice(0, 240),
    };
  }
}

export function skippedLiveProbe(url: string): LiveHttpProbe {
  return {
    requestUrl: url,
    finalUrl: null,
    status: null,
    probeStatus: "skipped",
    locationHeader: null,
    canonicalHref: null,
    robotsMeta: null,
    soft404Risk: false,
    notes: ["Live HTTP not requested (repository-only mode)"],
    error: null,
  };
}

export async function auditHttpIndexability(input: {
  inventory: TechSeoInventoryItem[];
  liveHttp: boolean;
  probe?: (url: string) => Promise<LiveHttpProbe>;
}): Promise<{
  rows: TechSeoEvidenceRow[];
  probes: LiveHttpProbe[];
  facts: string[];
  evidenceGaps: string[];
}> {
  const rows: TechSeoEvidenceRow[] = [];
  const facts: string[] = [];
  const evidenceGaps: string[] = [];
  const probes: LiveHttpProbe[] = [];

  if (!input.liveHttp) {
    evidenceGaps.push(
      "Live HTTP probes not run — repository-only mode; production status/canonical/robots meta UNKNOWN",
    );
    for (const item of input.inventory) {
      const url = absoluteInventoryUrl(item.path);
      probes.push(skippedLiveProbe(url));
      rows.push(
        row({
          area: "Redirects/404s",
          urlOrFile: item.path,
          observedState:
            "Live HTTP skipped — status/redirect/canonical UNKNOWN",
          expectedState:
            item.indexIntent === "index"
              ? "Expected 200 when live-probed; indexable"
              : item.indexIntent === "noindex"
                ? "Expected reachable with noindex"
                : "INTENT NOT DECLARED for indexability",
          severity: "INFO",
          evidence: "repository-only mode",
          recommendedAction:
            "Re-run with --live-http for production indexability evidence (GREEN)",
          permissionTier: "green",
        }),
      );
    }
    return { rows, probes, facts, evidenceGaps };
  }

  const probeFn = input.probe ?? defaultLiveHttpProbe;
  facts.push(`Live HTTP probes against ${INTENDED_CANONICAL_HOST}`);

  for (const item of input.inventory) {
    const url = absoluteInventoryUrl(item.path);
    const probe = await probeFn(url);
    probes.push(probe);

    if (probe.probeStatus === "unknown") {
      evidenceGaps.push(`Live probe UNKNOWN for ${item.path}: ${probe.error ?? "network failure"}`);
      rows.push(
        row({
          area: "Redirects/404s",
          urlOrFile: item.path,
          observedState: `UNKNOWN — ${probe.error ?? "probe failure"}`,
          expectedState: "200 or intentional redirect; evidence required",
          severity: "INFO",
          evidence: "Network/probe failure — INSUFFICIENT EVIDENCE (not fabricated)",
          recommendedAction: "Retry live probe later; do not infer indexability (GREEN)",
          permissionTier: "green",
        }),
      );
      continue;
    }

    const expectedOk =
      item.indexIntent === "undeclared" || item.indexIntent === "index";
    let severity: TechSeoEvidenceRow["severity"] = "INFO";
    if (probe.probeStatus === "not-found" && expectedOk) severity = "P0";
    else if (probe.probeStatus === "error") severity = "P1";
    else if (probe.soft404Risk) severity = "P1";
    else if (probe.probeStatus === "redirect") severity = "P2";

    rows.push(
      row({
        area: "Redirects/404s",
        urlOrFile: item.path,
        observedState: `status=${probe.status}; probe=${probe.probeStatus}; canonical=${probe.canonicalHref ?? "n/a"}; robots=${probe.robotsMeta ?? "n/a"}; soft404Risk=${probe.soft404Risk}`,
        expectedState:
          item.indexIntent === "undeclared"
            ? "INTENT NOT DECLARED — report observed HTTP only"
            : "200 with self-canonical on www host (unless intentional redirect)",
        severity,
        evidence: probe.notes.join("; "),
        recommendedAction:
          severity === "INFO"
            ? "No action from live probe"
            : "Investigate HTTP/indexability anomaly (YELLOW if changing site)",
        permissionTier: severity === "INFO" ? "green" : "yellow",
      }),
    );

    if (
      probe.canonicalHref &&
      item.indexIntent === "index" &&
      !probe.canonicalHref.includes("www.hourglassdiamonds.com") &&
      !probe.canonicalHref.startsWith("/")
    ) {
      rows.push(
        row({
          area: "Canonicals",
          urlOrFile: item.path,
          observedState: `Live canonical href=${probe.canonicalHref}`,
          expectedState: `www host or path resolving to ${INTENDED_CANONICAL_HOST}`,
          severity: "P0",
          evidence: "Live HTML link[rel=canonical]",
          recommendedAction: "Align live canonical with www host (YELLOW)",
          permissionTier: "yellow",
        }),
      );
    }
  }

  return { rows, probes, facts, evidenceGaps };
}
