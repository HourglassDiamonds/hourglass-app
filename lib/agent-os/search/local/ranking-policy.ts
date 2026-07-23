/**
 * Local Authority founder-ranking policy + semantic dedupe vs legacy GSC.
 *
 * Scoped to Local Authority / GBP Search Strategy output only.
 */

import type { Recommendation } from "../../types";
import { GBP_ROOT_SOURCE_GAP_ID } from "./types";
import { slugifyLocalSubject } from "./ids";

/** Finding families that may collide between legacy GSC and Local Authority. */
export type LocalDedupeFamily =
  | "near-page-one"
  | "high-impression-low-ctr"
  | "query-page-mismatch"
  | "local-intent-discovery"
  | "charlotte-guides-hub";

/**
 * Stable semantic key: family|q:<query>|g:<geo>|a:<action-family>
 * Not title-only. Null when the recommendation is outside this dedupe scope.
 */
export function buildLocalSemanticDedupeKey(
  rec: Recommendation,
): string | null {
  const id = rec.recommendationId;
  const family = classifyLocalDedupeFamily(id);
  if (!family) return null;

  const query = extractQuerySubject(id, rec);
  const geo = extractGeography(id) ?? "unknown";
  return `${family}|q:${query}|g:${geo}|a:${family}`;
}

export function classifyLocalDedupeFamily(
  recommendationId: string,
): LocalDedupeFamily | null {
  const id = recommendationId.toLowerCase();
  if (id.includes("charlotte-guides-hub") || id.includes("local-hub-gap")) {
    return "charlotte-guides-hub";
  }
  if (id.includes("high-impression-low-ctr")) {
    return "high-impression-low-ctr";
  }
  if (id.includes("local-near-page-one") || id.includes(":near-page-one:")) {
    return "near-page-one";
  }
  if (
    id.includes("local-query-page-mismatch") ||
    id.includes("query-page-mismatch")
  ) {
    return "query-page-mismatch";
  }
  if (id.includes("local-intent-gap") && !id.includes("charlotte-guides")) {
    return "local-intent-discovery";
  }
  return null;
}

/**
 * Prefer Local Authority–enriched recommendations over legacy GSC duplicates.
 * Marks losers as consolidated; retains underlying IDs.
 */
export function consolidateLegacyWithLocalAuthority(
  recommendations: Recommendation[],
): Recommendation[] {
  const groups = new Map<string, Recommendation[]>();
  const passthrough: Recommendation[] = [];

  for (const rec of recommendations) {
    const key = buildLocalSemanticDedupeKey(rec);
    if (!key) {
      passthrough.push(rec);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(rec);
    groups.set(key, list);
  }

  const out: Recommendation[] = [...passthrough];

  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => localAuthorityPreference(b) - localAuthorityPreference(a),
    );
    const canonical = sorted[0]!;
    out.push(canonical);
    for (const dup of sorted.slice(1)) {
      out.push({
        ...dup,
        status: "consolidated",
        agendaBucket: "ignore",
        priorityScore: 0,
        blockedReasons: [
          ...(dup.blockedReasons ?? []),
          `Consolidated into local-authority canonical ${canonical.recommendationId}`,
        ],
        dependencies: [
          ...new Set([...(dup.dependencies ?? []), canonical.recommendationId]),
        ],
      });
    }
  }

  return out;
}

/**
 * Cap repository-backed Local Authority items eligible for founder ranking.
 * - At most one repo-backed local item (Charlotte Guides hub preferred)
 * - Local guide/tool/Concierge link gaps require observed GSC demand
 * - Static repository evidence does not backfill empty brief slots when GSC is down
 */
export function applyLocalAuthorityFounderRankingGate(
  recommendations: Recommendation[],
  opts: {
    gscAvailable: boolean;
    hasObservedLocalDemand: boolean;
  },
): Recommendation[] {
  const hubId = pickCanonicalHubId(recommendations);

  return recommendations.map((rec) => {
    if (rec.status === "consolidated" || rec.status === "ignore") return rec;

    if (isBiOrContentLocalHandoff(rec)) {
      return demoteFromFounderRanking(
        rec,
        "Internal Local Authority handoff — not founder-rankable",
      );
    }

    if (!isRepositoryBackedLocalAuthorityRec(rec)) return rec;

    // Tool / Concierge link gaps need observed demand (and still count toward the 1-slot rule)
    if (isLocalGuideLinkGap(rec) && !opts.hasObservedLocalDemand) {
      return demoteFromFounderRanking(
        rec,
        "Local guide link gap requires observed GSC demand to be founder-rankable",
      );
    }

    if (isCharlotteGuidesHubRec(rec)) {
      if (hubId && rec.recommendationId === hubId) {
        return rec; // canonical hub — occupies the single repo-backed slot
      }
      return demoteFromFounderRanking(
        rec,
        hubId
          ? `Deferred to canonical hub ${hubId}`
          : "Duplicate Charlotte Guides hub deferred",
      );
    }

    // Non-hub repository-backed (e.g. tool gap with observed demand)
    if (hubId) {
      return demoteFromFounderRanking(
        rec,
        "Only one repository-backed Local Authority item may enter the founder brief (Charlotte Guides hub is canonical)",
      );
    }

    // No hub: allow a single link-gap only when observed demand exists
    if (opts.hasObservedLocalDemand && opts.gscAvailable) {
      // First non-hub in list keeps rank; others demoted — handled via second pass below
      return rec;
    }

    return demoteFromFounderRanking(
      rec,
      "Static repository Local Authority evidence does not backfill the founder brief when GSC is unavailable",
    );
  }).map((rec, _i, all) => {
    // Second pass: if no hub, keep only the first remaining founder-rankable repo-backed item
    if (hubId) return rec;
    if (!isRepositoryBackedLocalAuthorityRec(rec)) return rec;
    if (rec.status === "ignore" || rec.status === "consolidated") return rec;

    const firstAllowed = all.find(
      (r) =>
        isRepositoryBackedLocalAuthorityRec(r) &&
        r.status !== "ignore" &&
        r.status !== "consolidated" &&
        !isCharlotteGuidesHubRec(r),
    );
    if (firstAllowed && rec.recommendationId !== firstAllowed.recommendationId) {
      return demoteFromFounderRanking(
        rec,
        "Only one repository-backed Local Authority item may enter the founder brief",
      );
    }
    return rec;
  });
}

export function recommendationIsFounderRankableLocal(
  rec: Recommendation,
): boolean {
  return (
    rec.status !== "consolidated" &&
    rec.status !== "ignore" &&
    rec.status !== "blocked" &&
    rec.agendaBucket !== "ignore"
  );
}

export function isRepositoryBackedLocalAuthorityRec(
  rec: Recommendation,
): boolean {
  const id = rec.recommendationId;
  if (id === GBP_ROOT_SOURCE_GAP_ID) return false;
  if (isBiOrContentLocalHandoff(rec)) return false;
  if (
    id.includes("local-hub-gap") ||
    id.includes("charlotte-guides-hub") ||
    id.includes("local-tool-handoff-gap") ||
    id.includes("local-concierge-handoff-gap")
  ) {
    return true;
  }
  if (id.includes("repository:local-intent-gap:charlotte-guides")) {
    return true;
  }
  if (
    rec.evidence.some((e) => e.source === "repository-guide-authority") &&
    /charlotte guides/i.test(rec.title)
  ) {
    return true;
  }
  return false;
}

export function countFounderRankableRepositoryLocal(
  recommendations: Recommendation[],
): number {
  return recommendations.filter(
    (r) =>
      isRepositoryBackedLocalAuthorityRec(r) &&
      recommendationIsFounderRankableLocal(r),
  ).length;
}

function isCharlotteGuidesHubRec(rec: Recommendation): boolean {
  return (
    rec.recommendationId.includes("charlotte-guides-hub") ||
    rec.recommendationId.includes("local-hub-gap") ||
    /charlotte guides lack/i.test(rec.title)
  );
}

function isLocalGuideLinkGap(rec: Recommendation): boolean {
  return (
    rec.recommendationId.includes("local-tool-handoff-gap") ||
    rec.recommendationId.includes("local-concierge-handoff-gap") ||
    /local guide[–-]tool|local guide[–-]concierge/i.test(rec.title)
  );
}

function isBiOrContentLocalHandoff(rec: Recommendation): boolean {
  const id = rec.recommendationId;
  return (
    id.includes("local-measurement-gap") ||
    id.includes("content-handoff") ||
    id.includes("opportunity-handoff") ||
    (/local search demand supports a content/i.test(rec.title) &&
      /execution owner: content/i.test(rec.plainLanguageExplanation))
  );
}

function pickCanonicalHubId(recommendations: Recommendation[]): string | null {
  const hubs = recommendations.filter(
    (r) =>
      r.status !== "consolidated" &&
      isCharlotteGuidesHubRec(r) &&
      isRepositoryBackedLocalAuthorityRec(r),
  );
  if (hubs.length === 0) return null;
  const preferred = hubs.find((h) =>
    h.recommendationId.includes("charlotte-guides-hub"),
  );
  return (preferred ?? hubs[0]!).recommendationId;
}

function demoteFromFounderRanking(
  rec: Recommendation,
  reason: string,
): Recommendation {
  return {
    ...rec,
    status: "ignore",
    agendaBucket: "ignore",
    priorityScore: Math.min(rec.priorityScore, 0.01),
    blockedReasons: [...(rec.blockedReasons ?? []), reason],
  };
}

function localAuthorityPreference(rec: Recommendation): number {
  const id = rec.recommendationId;
  let score = rec.priorityScore * 10;
  if (id.includes(":local-near-page-one:")) score += 50;
  if (id.includes(":local-high-impression-low-ctr:")) score += 50;
  if (id.includes(":local-query-page-mismatch:")) score += 50;
  if (id.includes(":local-hub-gap:")) score += 40;
  if (id.includes(":local:")) score += 20;
  if (id.includes("repository:local-intent-gap:charlotte-guides")) score += 45;
  if (
    /:(charlotte|waxhaw|fort-mill|south-charlotte|charlotte-metro):/.test(id)
  ) {
    score += 10;
  }
  return score;
}

function extractQuerySubject(id: string, rec: Recommendation): string {
  const parts = id.split(":");
  const last = parts[parts.length - 1] ?? "";
  if (last && last !== "charlotte-guides" && last !== "charlotte-guides-hub") {
    return slugifyLocalSubject(last);
  }
  const m = rec.title.match(/[“"]([^”"]+)[”"]/);
  if (m?.[1]) return slugifyLocalSubject(m[1]);
  return slugifyLocalSubject(rec.title).slice(0, 48);
}

function extractGeography(id: string): string | null {
  const geos = [
    "south-charlotte",
    "charlotte-metro",
    "fort-mill",
    "waxhaw",
    "charlotte",
    "national",
  ];
  for (const g of geos) {
    if (id.includes(`:${g}:`) || id.endsWith(`:${g}`)) return g;
  }
  return null;
}
