/**
 * Explainable coverage scoring for fan-out questions.
 *
 * Integrity gates:
 * - "fully-covered" requires minimum direct-answer AND completeness —
 *   secondary signals cannot compensate for a missing direct answer.
 * - Format diversity / supporting evidence count unique canonical sources.
 * - Freshness is not credited when publication dates are unknown.
 * - Schema credit requires structured data on a direct/strong answering asset.
 */

import { matchLooksLikeDirectAnswer } from "./match";
import type {
  ContentMatch,
  CoverageBand,
  CoverageFactorScore,
  FanOutContentRecord,
  FanOutQuestion,
  QuestionCoverage,
} from "./types";

export const FACTOR_WEIGHTS = {
  directAnswer: 0.28,
  completeness: 0.16,
  specificity: 0.1,
  firstPartyExpertise: 0.1,
  supportingEvidence: 0.07,
  localRelevance: 0.07,
  formatDiversity: 0.06,
  freshness: 0.04,
  internalLinkSupport: 0.06,
  schemaSupport: 0.06,
} as const;

/** Numeric floor before gating. */
export const COVERAGE_SCORE_FULL_THRESHOLD = 72;
export const COVERAGE_SCORE_PARTIAL_THRESHOLD = 40;

/** Explicit gates — aggregate secondary signals cannot alone grant full coverage. */
export const FULLY_COVERED_MIN_DIRECT = 0.7;
export const FULLY_COVERED_MIN_COMPLETENESS = 0.5;

export function coverageBandFromScore(score: number): CoverageBand {
  if (score >= COVERAGE_SCORE_FULL_THRESHOLD) return "fully-covered";
  if (score >= COVERAGE_SCORE_PARTIAL_THRESHOLD) return "partially-covered";
  return "uncovered";
}

/**
 * Apply band with direct-answer / completeness gates.
 */
export function resolveCoverageBand(input: {
  rawScore: number;
  directAnswer: number;
  completeness: number;
}): { band: CoverageBand; gatedFromFullyCovered: boolean } {
  const numericBand = coverageBandFromScore(input.rawScore);
  if (numericBand !== "fully-covered") {
    return { band: numericBand, gatedFromFullyCovered: false };
  }
  if (
    input.directAnswer >= FULLY_COVERED_MIN_DIRECT &&
    input.completeness >= FULLY_COVERED_MIN_COMPLETENESS
  ) {
    return { band: "fully-covered", gatedFromFullyCovered: false };
  }
  return { band: "partially-covered", gatedFromFullyCovered: true };
}

function contentById(
  inventory: FanOutContentRecord[],
): Map<string, FanOutContentRecord> {
  return new Map(inventory.map((c) => [c.id, c]));
}

function factor(
  key: CoverageFactorScore["key"],
  label: string,
  weight: number,
  score: number,
  reason: string,
): CoverageFactorScore {
  return {
    key,
    label,
    weight,
    score: Number(Math.max(0, Math.min(1, score)).toFixed(3)),
    reason,
  };
}

/**
 * Score coverage for one question using matched content evidence.
 */
export function scoreQuestionCoverage(
  question: FanOutQuestion,
  matches: ContentMatch[],
  inventory: FanOutContentRecord[],
): QuestionCoverage {
  const byId = contentById(inventory);
  const matchedContent = matches
    .map((m) => byId.get(m.contentId))
    .filter((c): c is FanOutContentRecord => Boolean(c));

  const best = matches[0];
  const uniqueCanonicals = new Set(
    matchedContent.map((c) => c.canonicalSourceId),
  );

  const strongMatches = matches.filter((m) => m.strength === "strong");
  const moderateMatches = matches.filter((m) => m.strength === "moderate");
  const strongCanonicals = new Set(
    strongMatches
      .map((m) => byId.get(m.contentId)?.canonicalSourceId)
      .filter(Boolean),
  );
  const moderateCanonicals = new Set(
    moderateMatches
      .map((m) => byId.get(m.contentId)?.canonicalSourceId)
      .filter(Boolean),
  );

  const directMatches = matches.filter((m) => {
    const c = byId.get(m.contentId);
    if (!c) return false;
    const isAnswerShape =
      c.contentType === "faq" ||
      c.contentType === "approach-qa" ||
      c.contentType === "diamond-guide-article";
    return isAnswerShape && matchLooksLikeDirectAnswer(m) && m.score >= 0.55;
  });

  const hasStrongDirect = directMatches.some((m) => m.score >= 0.72);
  const hasModerateDirect = directMatches.length > 0;

  const directScore = hasStrongDirect
    ? 0.95
    : hasModerateDirect && best && best.score >= 0.62
      ? 0.75
      : hasModerateDirect
        ? 0.55
        : best && best.score >= 0.5
          ? 0.35
          : best
            ? 0.2
            : 0;

  const completeness =
    strongCanonicals.size >= 2
      ? 0.85
      : strongCanonicals.size === 1 && moderateCanonicals.size >= 1
        ? 0.65
        : strongCanonicals.size === 1
          ? 0.55
          : moderateCanonicals.size >= 2
            ? 0.4
            : uniqueCanonicals.size > 0
              ? 0.22
              : 0;

  const specificity = hasStrongDirect
    ? 0.9
    : hasModerateDirect
      ? 0.7
      : matchedContent.some((c) => c.contentType === "diamond-guide-article") &&
          best &&
          best.score >= 0.5
        ? 0.55
        : matchedContent.length > 0
          ? 0.3
          : 0;

  const firstPartyExpertise = matchedContent.some(
    (c) =>
      c.contentType === "approach-qa" ||
      c.contentType === "conversation" ||
      c.entities.some((e) =>
        /gemologist|selection-philosophy|founder|justin/i.test(e),
      ) ||
      c.topics.includes("approach"),
  )
    ? 0.9
    : matchedContent.some(
          (c) =>
            c.contentType === "diamond-guide-article" ||
            c.contentType === "core-page",
        )
      ? 0.65
      : matchedContent.length > 0
        ? 0.35
        : 0.1;

  const supportingEvidence =
    uniqueCanonicals.size >= 3
      ? 0.75
      : uniqueCanonicals.size === 2
        ? 0.55
        : uniqueCanonicals.size === 1
          ? 0.3
          : 0;

  const needsLocal =
    question.geography === "charlotte" ||
    question.geography === "waxhaw" ||
    question.geography === "charlotte-metro" ||
    question.searchIntent === "local" ||
    question.queryFamily === "local-charlotte-intent";

  let localRelevance = 0.5;
  if (needsLocal) {
    const localSubstantive = matches.some((m) => {
      const c = byId.get(m.contentId);
      if (!c) return false;
      const geoOk =
        c.geography === "charlotte" ||
        c.geography === "waxhaw" ||
        c.geography === "charlotte-metro";
      const termOk =
        /charlotte|waxhaw|ballantyne|weddington|marvin|fort mill|union county/i.test(
          c.searchableText,
        );
      // Accept moderate+ local answering assets (service-area FAQs, local guides)
      return geoOk && termOk && m.score >= 0.32;
    });
    localRelevance = localSubstantive ? 0.85 : 0.15;
  }

  const formatSet = new Set(
    matchedContent
      .filter((c) => {
        const m = matches.find((x) => x.contentId === c.id);
        return m && m.score >= 0.38;
      })
      .map((c) => c.contentType),
  );
  // Count formats across unique canonical sources only (already deduped in matches)
  const formatDiversity =
    formatSet.size >= 3 ? 0.75 : formatSet.size === 2 ? 0.55 : formatSet.size === 1 ? 0.35 : 0;

  const dated = matchedContent.filter((c) => Boolean(c.publishedOrUpdatedAt));
  const freshness =
    dated.length > 0
      ? 0.65
      : matchedContent.length > 0
        ? 0.2
        : 0.1;

  const linked = matchedContent.filter((c) => {
    const m = matches.find((x) => x.contentId === c.id);
    return m && m.score >= 0.38 && c.relatedHrefs.length >= 1;
  });
  const internalLinkSupport =
    linked.some((c) => c.relatedHrefs.length >= 2)
      ? 0.75
      : linked.length > 0
        ? 0.5
        : matchedContent.length > 0
          ? 0.15
          : 0.05;

  const schemaOnAnsweringAsset = directMatches.some((m) => {
    const c = byId.get(m.contentId);
    return Boolean(c?.hasStructuredData);
  });
  const schemaSupport = schemaOnAnsweringAsset
    ? 0.85
    : matchedContent.length > 0
      ? 0.15
      : 0.05;

  const factors: CoverageFactorScore[] = [
    factor(
      "directAnswer",
      "Direct answer exists",
      FACTOR_WEIGHTS.directAnswer,
      directScore,
      hasStrongDirect
        ? "Strong direct Q&A or title-aligned answer present"
        : hasModerateDirect
          ? "Moderate direct-answer evidence present"
          : best
            ? `Best match is not a direct answer (${best.strength}, ${best.score})`
            : "No direct answering asset matched",
    ),
    factor(
      "completeness",
      "Answer completeness",
      FACTOR_WEIGHTS.completeness,
      completeness,
      `${strongCanonicals.size} strong / ${moderateCanonicals.size} moderate canonical sources`,
    ),
    factor(
      "specificity",
      "Content specificity",
      FACTOR_WEIGHTS.specificity,
      specificity,
      hasStrongDirect || hasModerateDirect
        ? "Question-aligned answering asset present"
        : "Limited question-specific answering depth",
    ),
    factor(
      "firstPartyExpertise",
      "First-party expertise",
      FACTOR_WEIGHTS.firstPartyExpertise,
      firstPartyExpertise,
      "Hourglass-owned educational or advisory content signals",
    ),
    factor(
      "supportingEvidence",
      "Supporting evidence",
      FACTOR_WEIGHTS.supportingEvidence,
      supportingEvidence,
      `${uniqueCanonicals.size} unique canonical sources (not raw fragment count)`,
    ),
    factor(
      "localRelevance",
      "Local relevance",
      FACTOR_WEIGHTS.localRelevance,
      localRelevance,
      needsLocal
        ? localRelevance >= 0.5
          ? "Substantive local Charlotte/Waxhaw match present"
          : "Local intent without substantive local answering match"
        : "Non-local question — neutral local factor",
    ),
    factor(
      "formatDiversity",
      "Format diversity",
      FACTOR_WEIGHTS.formatDiversity,
      formatDiversity,
      `${formatSet.size} distinct formats across unique canonical sources`,
    ),
    factor(
      "freshness",
      "Content freshness",
      FACTOR_WEIGHTS.freshness,
      freshness,
      dated.length > 0
        ? `Verified date on ${dated.length} matched asset(s)`
        : "No verified publication/update date — freshness not credited",
    ),
    factor(
      "internalLinkSupport",
      "Internal-link support",
      FACTOR_WEIGHTS.internalLinkSupport,
      internalLinkSupport,
      linked.length > 0
        ? "Verified relatedHrefs on substantive matched assets"
        : "No verified internal links on substantive matches",
    ),
    factor(
      "schemaSupport",
      "Schema / structured data",
      FACTOR_WEIGHTS.schemaSupport,
      schemaSupport,
      schemaOnAnsweringAsset
        ? "Structured data present on a direct-answer asset"
        : "No structured data on a direct-answer asset",
    ),
  ];

  const weighted = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const rawScore = Number((weighted * 100).toFixed(1));
  const { band, gatedFromFullyCovered } = resolveCoverageBand({
    rawScore,
    directAnswer: directScore,
    completeness,
  });

  const reasons: string[] = [];
  if (matches.length === 0) {
    reasons.push("No repository content matched above the minimum threshold");
  } else {
    reasons.push(
      `Top match score ${best!.score} (${best!.strength}) via ${best!.reasons[0] ?? "term overlap"}`,
    );
    reasons.push(
      `Evidence collapsed to ${uniqueCanonicals.size} unique canonical source(s)`,
    );
  }
  if (gatedFromFullyCovered) {
    reasons.push(
      `Gated from fully-covered: requires directAnswer≥${FULLY_COVERED_MIN_DIRECT} and completeness≥${FULLY_COVERED_MIN_COMPLETENESS} (have ${directScore.toFixed(2)} / ${completeness.toFixed(2)})`,
    );
  }
  for (const f of factors) {
    if (f.score < 0.4 && (needsLocal || f.key !== "localRelevance")) {
      reasons.push(`Weak factor — ${f.label}: ${f.reason}`);
    }
  }
  if (band === "fully-covered") {
    reasons.push("Coverage band: fully covered");
  } else if (band === "partially-covered") {
    reasons.push("Coverage band: partial — strengthen existing assets before new pages");
  } else {
    reasons.push("Coverage band: uncovered — high-value gap candidate");
  }

  return {
    questionId: question.id,
    band,
    score: rawScore,
    factors,
    matches,
    reasons: reasons.slice(0, 10),
  };
}
