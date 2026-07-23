/**
 * GSC → SearchOpportunity detectors.
 * Never fabricates rows when GSC is unavailable.
 */

import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import {
  classifyQueryIntent,
  isBrandQuery,
  isLocalIntent,
  isSmallSample,
  sampleSizeConfidencePenalty,
} from "./classify";
import { buildSearchOpportunityId } from "./ids";
import type { SearchOpportunity } from "./types";

const MIN_IMPRESSIONS_CTR = 400;
const LOW_CTR = 0.025;
const NEAR_PAGE_ONE_MIN = 4;
const NEAR_PAGE_ONE_MAX = 15;
const DECLINE_PCT = -15;
const RISE_PCT = 20;

export function detectGscOpportunities(
  gsc: GscWeeklyBundle | null,
  opts?: { available: boolean },
): SearchOpportunity[] {
  if (!opts?.available || !gsc?.current) {
    return [];
  }

  const out: SearchOpportunity[] = [];
  const currentQueries = gsc.current.topQueries ?? [];
  const previousQueries = gsc.previous?.topQueries ?? [];
  const currentPages = gsc.current.topPages ?? [];
  const previousPages = gsc.previous?.topPages ?? [];

  for (const row of currentQueries) {
    const classes = classifyQueryIntent(row.query);
    const samplePenalty = sampleSizeConfidencePenalty(
      row.impressions,
      row.clicks,
    );

    if (
      row.impressions >= MIN_IMPRESSIONS_CTR &&
      row.ctr < LOW_CTR &&
      !isBrandQuery(row.query)
    ) {
      out.push({
        id: buildSearchOpportunityId({
          source: "gsc",
          type: "high-impression-low-ctr",
          subject: row.query,
        }),
        type: "high-impression-low-ctr",
        title: `Improve CTR for “${row.query}”`,
        whyItMatters:
          "Strong discovery volume with weak click-through wastes existing Search Console demand.",
        recommendedAction:
          "Review title/meta and opening promise for the best-matching Diamond Guide or tool page; keep brand voice — do not publish new pages yet.",
        queryOrPage: row.query,
        metric: "ctr",
        currentValue: `${(row.ctr * 100).toFixed(2)}% CTR · ${row.impressions} impressions · pos ${row.position.toFixed(1)}`,
        comparisonValue: null,
        sampleSize: row.impressions,
        classifications: classes,
        isInference: false,
        confidence: round(0.78 * samplePenalty),
        likelyImpact: isLocalIntent(row.query) ? 8 : 7,
        effort: "low",
        urgency: "high",
        approvalRequired: false,
        supportingReference: "gsc.topQueries",
        evidenceNotes: [
          `Impressions ${row.impressions}, clicks ${row.clicks}, CTR ${(row.ctr * 100).toFixed(2)}%`,
          isSmallSample(row.impressions, row.clicks)
            ? "Sample size is modest — treat as directional"
            : "Sample size adequate for CTR review",
        ],
      });
    }

    if (
      row.position >= NEAR_PAGE_ONE_MIN &&
      row.position <= NEAR_PAGE_ONE_MAX &&
      row.impressions >= 150 &&
      !isBrandQuery(row.query)
    ) {
      out.push({
        id: buildSearchOpportunityId({
          source: "gsc",
          type: "near-page-one",
          subject: row.query,
        }),
        type: "near-page-one",
        title: `Strengthen ranking for “${row.query}” (position ${row.position.toFixed(1)})`,
        whyItMatters:
          "Positions 4–15 often repay contained authority and CTR work more than net-new topics.",
        recommendedAction:
          "Reinforce the best-matching guide’s opening answer, related links, and tool handoff — read-only plan only; no live edits from Agent OS.",
        queryOrPage: row.query,
        metric: "position",
        currentValue: `pos ${row.position.toFixed(1)} · ${row.impressions} impressions`,
        comparisonValue: null,
        sampleSize: row.impressions,
        classifications: classes,
        isInference: false,
        confidence: round(0.74 * samplePenalty),
        likelyImpact: 8,
        effort: "medium",
        urgency: "high",
        approvalRequired: false,
        supportingReference: "gsc.topQueries",
        evidenceNotes: [
          `Non-branded query in positions ${NEAR_PAGE_ONE_MIN}–${NEAR_PAGE_ONE_MAX}`,
        ],
      });
    }

    const prev = previousQueries.find(
      (p) => p.query.toLowerCase() === row.query.toLowerCase(),
    );
    if (prev && prev.clicks > 0) {
      const delta = ((row.clicks - prev.clicks) / prev.clicks) * 100;
      if (delta <= DECLINE_PCT && row.impressions >= 100) {
        out.push({
          id: buildSearchOpportunityId({
            source: "gsc",
            type: "declining-query",
            subject: row.query,
          }),
          type: "declining-query",
          title: `Investigate declining clicks for “${row.query}”`,
          whyItMatters:
            "Click decline may be ranking, CTR, or SERP change — diagnose before rewriting.",
          recommendedAction:
            "Compare position and CTR week-over-week; prefer measurement review over a broad rewrite.",
          queryOrPage: row.query,
          metric: "clicks",
          currentValue: `${row.clicks} clicks`,
          comparisonValue: `${prev.clicks} prior · ${delta.toFixed(0)}%`,
          sampleSize: row.impressions,
          classifications: classes,
          isInference: false,
          confidence: round(0.65 * samplePenalty),
          likelyImpact: 6,
          effort: "medium",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: "gsc.topQueries.wow",
          evidenceNotes: [`Click delta ${delta.toFixed(0)}% vs prior week`],
        });
      }
      if (delta >= RISE_PCT && row.impressions >= 100) {
        out.push({
          id: buildSearchOpportunityId({
            source: "gsc",
            type: "rising-query",
            subject: row.query,
          }),
          type: "rising-query",
          title: `Protect rising demand for “${row.query}”`,
          whyItMatters:
            "Rising queries with matching guides compound authority when handoffs are clear.",
          recommendedAction:
            "Confirm the landing guide/tool path and strengthen internal links from related hubs.",
          queryOrPage: row.query,
          metric: "clicks",
          currentValue: `${row.clicks} clicks`,
          comparisonValue: `${prev.clicks} prior · +${delta.toFixed(0)}%`,
          sampleSize: row.impressions,
          classifications: classes,
          isInference: false,
          confidence: round(0.7 * samplePenalty),
          likelyImpact: 7,
          effort: "low",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: "gsc.topQueries.wow",
          evidenceNotes: [`Click delta +${delta.toFixed(0)}% vs prior week`],
        });
      }
    }
  }

  for (const row of currentPages) {
    const prev = previousPages.find((p) => p.page === row.page);
    if (prev && prev.clicks > 0) {
      const delta = ((row.clicks - prev.clicks) / prev.clicks) * 100;
      if (delta <= DECLINE_PCT && row.impressions >= 200) {
        out.push({
          id: buildSearchOpportunityId({
            source: "gsc",
            type: "declining-page",
            subject: pathKey(row.page),
          }),
          type: "declining-page",
          title: `Review declining page ${pathKey(row.page)}`,
          whyItMatters:
            "Page-level click declines can signal title, intent mismatch, or ranking drift.",
          recommendedAction:
            "Compare impressions vs clicks and position before any content change proposal.",
          queryOrPage: row.page,
          metric: "clicks",
          currentValue: `${row.clicks} clicks`,
          comparisonValue: `${prev.clicks} prior · ${delta.toFixed(0)}%`,
          sampleSize: row.impressions,
          classifications: ["informational"],
          isInference: false,
          confidence: round(
            0.62 * sampleSizeConfidencePenalty(row.impressions, row.clicks),
          ),
          likelyImpact: 6,
          effort: "medium",
          urgency: "medium",
          approvalRequired: false,
          supportingReference: "gsc.topPages.wow",
          evidenceNotes: [`Page click delta ${delta.toFixed(0)}%`],
        });
      }
    }

    if (
      row.impressions >= MIN_IMPRESSIONS_CTR &&
      row.ctr < LOW_CTR &&
      row.position <= 20
    ) {
      out.push({
        id: buildSearchOpportunityId({
          source: "gsc",
          type: "high-impression-low-ctr",
          subject: pathKey(row.page),
        }),
        type: "high-impression-low-ctr",
        title: `Improve CTR on ${pathKey(row.page)}`,
        whyItMatters:
          "The page already earns impressions; CTR work is higher leverage than inventing new URLs.",
        recommendedAction:
          "Audit title/description alignment to top queries landing here (read-only recommendation).",
        queryOrPage: row.page,
        metric: "ctr",
        currentValue: `${(row.ctr * 100).toFixed(2)}% CTR · ${row.impressions} impressions`,
        comparisonValue: null,
        sampleSize: row.impressions,
        classifications: ["informational"],
        isInference: false,
        confidence: round(
          0.72 * sampleSizeConfidencePenalty(row.impressions, row.clicks),
        ),
        likelyImpact: 7,
        effort: "low",
        urgency: "high",
        approvalRequired: false,
        supportingReference: "gsc.topPages",
        evidenceNotes: [
          `Position ${row.position.toFixed(1)}; CTR ${(row.ctr * 100).toFixed(2)}%`,
        ],
      });
    }
  }

  // Query–page mismatch: top non-brand query lacks an obvious matching top page path
  for (const q of currentQueries.slice(0, 15)) {
    if (isBrandQuery(q.query) || q.impressions < 300) continue;
    const token = primaryToken(q.query);
    if (!token) continue;
    const matched = currentPages.some((p) =>
      pathKey(p.page).toLowerCase().includes(token),
    );
    if (!matched) {
      out.push({
        id: buildSearchOpportunityId({
          source: "gsc",
          type: "query-page-mismatch",
          subject: q.query,
        }),
        type: "query-page-mismatch",
        title: `Query–page mismatch risk for “${q.query}”`,
        whyItMatters:
          "Demand appears in Search Console without a clearly matching top landing page in the same week.",
        recommendedAction:
          "Map the query to the best existing Diamond Guide or tool URL; prefer internal linking over a new page unless no match exists.",
        queryOrPage: q.query,
        metric: "query-page-alignment",
        currentValue: `${q.impressions} impressions; no token-matched top page`,
        comparisonValue: null,
        sampleSize: q.impressions,
        classifications: classifyQueryIntent(q.query),
        isInference: true,
        confidence: round(
          0.55 * sampleSizeConfidencePenalty(q.impressions, q.clicks),
        ),
        likelyImpact: 7,
        effort: "medium",
        urgency: "medium",
        dependency: "Guide-authority mapping confirmation",
        approvalRequired: false,
        supportingReference: "gsc.query-vs-page",
        evidenceNotes: [
          "Inference from top-query vs top-page lists (not query×page cross-dimension)",
          "Do not treat as confirmed cannibalization",
        ],
      });
    }
  }

  // Soft cannibalization: multiple diamond-guide pages with high impressions
  const guidePages = currentPages.filter((p) =>
    pathKey(p.page).includes("/diamond-guide/"),
  );
  if (guidePages.length >= 2) {
    const a = guidePages[0]!;
    const b = guidePages[1]!;
    if (a.impressions >= 400 && b.impressions >= 400) {
      const pair = [pathKey(a.page), pathKey(b.page)].sort().join("|");
      out.push({
        id: buildSearchOpportunityId({
          source: "gsc",
          type: "possible-cannibalization",
          subject: pair,
        }),
        type: "possible-cannibalization",
        title: "Possible guide overlap in Search Console landings",
        whyItMatters:
          "Two guide URLs both earn material impressions — overlap may dilute clarity, but this is not proof of cannibalization.",
        recommendedAction:
          "Compare topics and related-link roles; only propose consolidation if content audits confirm duplication.",
        queryOrPage: `${pathKey(a.page)} vs ${pathKey(b.page)}`,
        metric: "impressions",
        currentValue: `${a.impressions} vs ${b.impressions} impressions`,
        comparisonValue: null,
        sampleSize: a.impressions + b.impressions,
        classifications: ["informational"],
        isInference: true,
        confidence: 0.4,
        likelyImpact: 4,
        effort: "high",
        urgency: "low",
        approvalRequired: true,
        supportingReference: "gsc.topPages",
        evidenceNotes: [
          "Labeled possible only — adapter lacks query×page matrix",
          "Do not overclaim cannibalization",
        ],
      });
    }
  }

  // Local intent without fabricating GBP
  const localQueries = currentQueries.filter(
    (q) => isLocalIntent(q.query) && !isBrandQuery(q.query) && q.impressions >= 80,
  );
  if (localQueries.length > 0) {
    const top = localQueries[0]!;
    out.push({
      id: buildSearchOpportunityId({
        source: "gsc",
        type: "local-intent-gap",
        subject: top.query,
      }),
      type: "local-intent-gap",
      title: `Local discovery demand for “${top.query}”`,
      whyItMatters:
        "Regional intent appears in Search Console; GBP pack metrics are unavailable to Agent OS.",
      recommendedAction:
        "Use Charlotte Guide cluster and location-consistent titles/schema already in-repo; do not invent GBP actions.",
      queryOrPage: top.query,
      metric: "impressions",
      currentValue: `${top.impressions} impressions · pos ${top.position.toFixed(1)}`,
      comparisonValue: null,
      sampleSize: top.impressions,
      classifications: classifyQueryIntent(top.query),
      isInference: false,
      confidence: round(
        0.68 * sampleSizeConfidencePenalty(top.impressions, top.clicks),
      ),
      likelyImpact: 7,
      effort: "medium",
      urgency: "medium",
      dependency: "GBP metrics unavailable — repository + GSC only",
      approvalRequired: false,
      supportingReference: "gsc.local-intent",
      evidenceNotes: [
        "GBP search visibility not measured — measurement gap remains explicit",
      ],
    });
  }

  return out;
}

function pathKey(page: string): string {
  try {
    const u = new URL(page);
    return u.pathname;
  } catch {
    return page;
  }
}

function primaryToken(query: string): string | null {
  const stop = new Set([
    "a",
    "an",
    "the",
    "for",
    "in",
    "of",
    "to",
    "and",
    "or",
    "vs",
    "versus",
  ]);
  const parts = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 3 && !stop.has(p));
  return parts[0] ?? null;
}

function round(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
}
