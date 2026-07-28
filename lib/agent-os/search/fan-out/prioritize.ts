/**
 * Explainable prioritization and recommendation generation for fan-out gaps.
 * Includes gap-cluster consolidation to avoid competing thin-page recommendations.
 */

import { matchLooksLikeDirectAnswer } from "./match";
import {
  getGapClusterDefinition,
  resolveGapClusterId,
} from "./clusters";
import { slugifyFanOutId } from "./normalize";
import type {
  ContentMatch,
  FanOutContentRecord,
  FanOutOpportunity,
  FanOutQuestion,
  GapClusterRole,
  QuestionCoverage,
  RecommendedContentAction,
  RecommendedContentFormat,
} from "./types";

/** Stage proximity to conversion (0–1). */
const STAGE_PROXIMITY: Record<FanOutQuestion["audienceStage"], number> = {
  discovering: 0.35,
  researching: 0.5,
  comparing: 0.7,
  selecting: 0.85,
  "ready-to-contact": 1,
  "post-purchase": 0.25,
};

const FAMILY_EXPERTISE_FIT: Partial<Record<FanOutQuestion["queryFamily"], number>> = {
  "cut-and-sparkle": 1,
  "diamond-quality": 1,
  "natural-versus-lab": 0.9,
  "trust-ethics-credibility": 0.95,
  "luxury-and-private-client": 0.95,
  "local-charlotte-intent": 0.9,
  "custom-design": 0.9,
  "jeweler-comparison": 0.85,
  "buying-process-anxiety": 0.85,
  "shapes-and-appearance": 0.8,
  "pricing-and-budgeting": 0.75,
  "beginner-education": 0.75,
  "proposal-and-surprise": 0.55,
  "maintenance-repairs-ownership": 0.45,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function chooseAction(
  question: FanOutQuestion,
  coverage: QuestionCoverage,
  suggestedPage: string | null,
  matched: FanOutContentRecord[],
): { action: RecommendedContentAction; format: RecommendedContentFormat; why: string[] } {
  const why: string[] = [];
  if (coverage.band === "fully-covered") {
    return {
      action: "no-action-needed",
      format: "internal-links",
      why: ["Coverage is already strong"],
    };
  }

  const hasGuide = matched.some((c) => c.contentType === "diamond-guide-article");
  const hasFaq = matched.some((c) => c.contentType === "faq");
  const hasCore = matched.some(
    (c) => c.contentType === "core-page" || c.contentType === "local-landing",
  );
  const directFactor = coverage.factors.find((f) => f.key === "directAnswer")?.score ?? 0;
  const schemaOnDirect =
    coverage.factors.find((f) => f.key === "schemaSupport")?.score ?? 0;
  const weakLinks = matched.some(
    (c) => c.contentType === "diamond-guide-article" && c.relatedHrefs.length < 2,
  );

  if (
    question.queryFamily === "local-charlotte-intent" &&
    coverage.score < 55 &&
    !matched.some((c) => c.geography !== "unspecified" && c.geography !== "national")
  ) {
    why.push("Local intent without a strong local answering section");
    return {
      action: "create-local-landing-section",
      format: "local-landing-section",
      why,
    };
  }

  if (suggestedPage && (hasGuide || hasCore || hasFaq) && coverage.band === "partially-covered") {
    why.push("Prefer expanding an existing authoritative page over creating a new URL");
    if (schemaOnDirect < 0.5 && directFactor >= 0.55 && question.canonicalQuestion.length < 90) {
      return { action: "add-schema", format: "schema-markup", why };
    }
    if (weakLinks && hasGuide) {
      return { action: "strengthen-internal-linking", format: "internal-links", why };
    }
    if (directFactor < 0.7) {
      return { action: "add-faq", format: "faq-block", why };
    }
    if (
      question.queryFamily === "cut-and-sparkle" ||
      question.queryFamily === "shapes-and-appearance"
    ) {
      return {
        action: "add-comparison-or-demonstration",
        format: "comparison-demonstration",
        why,
      };
    }
    if (
      question.queryFamily === "trust-ethics-credibility" ||
      question.queryFamily === "diamond-quality"
    ) {
      return { action: "add-founder-evidence", format: "founder-evidence-block", why };
    }
    return { action: "expand-existing-page", format: "core-page-section", why };
  }

  if (coverage.band === "uncovered" && !hasGuide) {
    if (
      question.queryFamily === "maintenance-repairs-ownership" ||
      question.audienceStage === "post-purchase"
    ) {
      why.push("Thin ownership/maintenance coverage — FAQ may be enough before a full guide");
      return { action: "add-faq", format: "faq-block", why };
    }
    if (question.audienceStage === "ready-to-contact") {
      why.push("Conversion-proximate question — strengthen Concierge/core conversion path");
      return {
        action: "expand-existing-page",
        format: "core-page-section",
        why,
      };
    }
    why.push("No strong guide match — Diamond Guide article is the preferred authority format");
    return {
      action: "create-diamond-guide-article",
      format: "diamond-guide-article",
      why,
    };
  }

  if (directFactor < 0.7 && coverage.score < 65) {
    why.push("Add a visible FAQ answer on an existing page");
    return { action: "add-faq", format: "faq-block", why };
  }

  why.push("Expand the closest existing asset");
  return {
    action: "expand-existing-page",
    format: suggestedPage ? "core-page-section" : "diamond-guide-article",
    why,
  };
}

function suggestExistingPage(
  matches: ContentMatch[],
  inventory: FanOutContentRecord[],
  question: FanOutQuestion,
): string | null {
  const byId = new Map(inventory.map((c) => [c.id, c]));
  const ranked = [...matches].sort((a, b) => {
    const ca = byId.get(a.contentId);
    const cb = byId.get(b.contentId);
    const scoreA = a.score + pageFitBonus(question, ca);
    const scoreB = b.score + pageFitBonus(question, cb);
    return scoreB - scoreA;
  });
  for (const match of ranked) {
    if (match.score < 0.4 && !matchLooksLikeDirectAnswer(match)) continue;
    const content = byId.get(match.contentId);
    if (!content) continue;
    if (
      content.contentType === "diamond-guide-article" ||
      content.contentType === "core-page" ||
      content.contentType === "local-landing" ||
      content.contentType === "approach-qa" ||
      content.contentType === "faq"
    ) {
      return content.canonicalSourceId;
    }
  }
  return null;
}

function pageFitBonus(
  question: FanOutQuestion,
  content: FanOutContentRecord | undefined,
): number {
  if (!content) return 0;
  let bonus = 0;
  if (
    question.geography !== "unspecified" &&
    question.geography !== "national" &&
    (content.geography === question.geography ||
      content.geography === "charlotte-metro" ||
      content.geography === "charlotte")
  ) {
    bonus += 0.15;
  }
  if (
    content.topics.some((t) => question.topics.includes(t)) ||
    content.topics.includes(question.queryFamily)
  ) {
    bonus += 0.1;
  }
  if (
    question.queryFamily === "local-charlotte-intent" &&
    /charlotte|waxhaw|local/i.test(content.canonicalSourceId + content.title)
  ) {
    bonus += 0.2;
  }
  return bonus;
}

/**
 * Compute explainable priority 0–100 for a coverage gap.
 */
export function computeFanOutPriorityScore(input: {
  question: FanOutQuestion;
  coverage: QuestionCoverage;
  canStrengthenExisting: boolean;
}): { score: number; reasons: string[] } {
  const { question, coverage, canStrengthenExisting } = input;
  const gap = clamp01((100 - coverage.score) / 100);
  const commercial = clamp01(question.commercialValue / 10);
  const authority = clamp01(question.authorityValue / 10);
  const local =
    question.searchIntent === "local" ||
    question.queryFamily === "local-charlotte-intent" ||
    question.geography === "charlotte" ||
    question.geography === "waxhaw" ||
    question.geography === "charlotte-metro"
      ? 0.9
      : 0.45;
  const stage = STAGE_PROXIMITY[question.audienceStage];
  const expertise = FAMILY_EXPERTISE_FIT[question.queryFamily] ?? 0.6;
  const existingBoost = canStrengthenExisting ? 0.85 : 0.55;
  const duplicationRisk = question.status === "duplicate" || question.duplicateOfId ? 0.85 : 0.1;

  const raw =
    100 *
    (0.28 * gap +
      0.18 * commercial +
      0.16 * authority +
      0.1 * local +
      0.12 * stage +
      0.08 * expertise +
      0.08 * existingBoost) *
    (1 - 0.7 * duplicationRisk);

  const reasons = [
    `Coverage gap ${(gap * 100).toFixed(0)}%`,
    `Commercial ${question.commercialValue}/10 · Authority ${question.authorityValue}/10`,
    `Audience stage ${question.audienceStage} (proximity ${(stage * 100).toFixed(0)}%)`,
    `Expertise fit ${(expertise * 100).toFixed(0)}% for ${question.queryFamily}`,
    canStrengthenExisting
      ? "Can strengthen an existing asset (preferred)"
      : "May require net-new content",
    duplicationRisk > 0.2 ? "Duplication risk applied" : "Low duplication risk",
  ];

  return { score: Number(Math.max(0, Math.min(100, raw)).toFixed(1)), reasons };
}

function baseOpportunityFields(): Pick<
  FanOutOpportunity,
  | "gapClusterId"
  | "clusterRole"
  | "flagshipTitle"
  | "supportingQuestionIds"
  | "consolidatedIntoOpportunityId"
> {
  return {
    gapClusterId: null,
    clusterRole: "distinct",
    flagshipTitle: null,
    supportingQuestionIds: [],
    consolidatedIntoOpportunityId: null,
  };
}

export function buildFanOutOpportunity(input: {
  question: FanOutQuestion;
  coverage: QuestionCoverage;
  inventory: FanOutContentRecord[];
}): FanOutOpportunity | null {
  const { question, coverage, inventory } = input;
  if (question.status === "duplicate" || question.status === "deprecated") {
    return null;
  }

  const byId = new Map(inventory.map((c) => [c.id, c]));
  const matched = coverage.matches
    .map((m) => byId.get(m.contentId))
    .filter((c): c is FanOutContentRecord => Boolean(c));

  const suggestedExistingPage = suggestExistingPage(
    coverage.matches,
    inventory,
    question,
  );
  const { action, format, why } = chooseAction(
    question,
    coverage,
    suggestedExistingPage,
    matched,
  );

  if (action === "no-action-needed") return null;

  const { score, reasons } = computeFanOutPriorityScore({
    question,
    coverage,
    canStrengthenExisting: Boolean(suggestedExistingPage),
  });

  const whyCoverageWeak = coverage.reasons.filter(
    (r) => !r.startsWith("Coverage band: fully"),
  );

  return {
    id: `search-strategy:repository:fan-out-coverage-gap:${slugifyFanOutId(question.canonicalQuestion)}`,
    questionId: question.id,
    question: question.canonicalQuestion,
    queryFamily: question.queryFamily,
    audienceStage: question.audienceStage,
    geography: question.geography,
    coverageScore: coverage.score,
    coverageBand: coverage.band,
    whyCoverageWeak: [...whyCoverageWeak, ...why].slice(0, 6),
    recommendedAction: action,
    recommendedFormat: format,
    suggestedExistingPage,
    commercialValue: question.commercialValue,
    authorityValue: question.authorityValue,
    priorityScore: score,
    priorityReasons: reasons,
    ...baseOpportunityFields(),
  };
}

/**
 * Collapse overlapping buyer-orientation gaps into one flagship + supporting FAQs.
 */
export function consolidateOpportunityClusters(
  opportunities: FanOutOpportunity[],
  inventory: FanOutContentRecord[],
): FanOutOpportunity[] {
  const byCluster = new Map<string, FanOutOpportunity[]>();
  const unclustered: FanOutOpportunity[] = [];

  for (const opp of opportunities) {
    const clusterId = resolveGapClusterId(opp.question);
    if (!clusterId) {
      unclustered.push({ ...opp, clusterRole: "distinct" as GapClusterRole });
      continue;
    }
    const list = byCluster.get(clusterId) ?? [];
    list.push(opp);
    byCluster.set(clusterId, list);
  }

  const consolidated: FanOutOpportunity[] = [...unclustered];

  for (const [clusterId, members] of byCluster) {
    const def = getGapClusterDefinition(clusterId);
    if (!def || members.length === 1) {
      for (const m of members) {
        consolidated.push({
          ...m,
          gapClusterId: clusterId,
          clusterRole: "distinct",
          flagshipTitle: null,
        });
      }
      continue;
    }

    const ranked = [...members].sort((a, b) => b.priorityScore - a.priorityScore);
    const primary = ranked[0]!;
    const supporting = ranked.slice(1);

    const existingInInventory = def.preferredExistingPages.find((page) =>
      inventory.some((c) => c.canonicalSourceId === page),
    );

    const flagship: FanOutOpportunity = {
      ...primary,
      gapClusterId: clusterId,
      clusterRole: "flagship",
      flagshipTitle: def.flagshipTitle,
      supportingQuestionIds: supporting.map((s) => s.questionId),
      consolidatedIntoOpportunityId: null,
      recommendedAction: existingInInventory
        ? "expand-existing-page"
        : "create-diamond-guide-article",
      recommendedFormat: existingInInventory
        ? "core-page-section"
        : "diamond-guide-article",
      suggestedExistingPage: existingInInventory ?? primary.suggestedExistingPage,
      priorityScore: Number(
        Math.min(100, primary.priorityScore + 4 + supporting.length * 1.5).toFixed(1),
      ),
      whyCoverageWeak: [
        `Cluster ${clusterId}: consolidate ${members.length} overlapping gaps into flagship “${def.flagshipTitle}”`,
        ...primary.whyCoverageWeak.slice(0, 4),
      ],
      priorityReasons: [
        `Flagship for ${members.length} overlapping buyer-orientation questions`,
        ...primary.priorityReasons.slice(0, 4),
      ],
    };

    consolidated.push(flagship);

    for (const s of supporting) {
      consolidated.push({
        ...s,
        gapClusterId: clusterId,
        clusterRole: "supporting-faq",
        flagshipTitle: def.flagshipTitle,
        supportingQuestionIds: [],
        consolidatedIntoOpportunityId: flagship.id,
        recommendedAction: "add-faq",
        recommendedFormat: "faq-block",
        suggestedExistingPage:
          flagship.suggestedExistingPage ?? s.suggestedExistingPage,
        priorityScore: Number((s.priorityScore * 0.45).toFixed(1)),
        whyCoverageWeak: [
          `Supporting FAQ under flagship “${def.flagshipTitle}” — do not create a competing thin page`,
          ...s.whyCoverageWeak.slice(0, 3),
        ],
        priorityReasons: [
          "Demoted as supporting FAQ within gap cluster",
          ...s.priorityReasons.slice(0, 3),
        ],
      });
    }
  }

  return consolidated.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function prioritizeFanOutOpportunities(
  questions: FanOutQuestion[],
  coverages: QuestionCoverage[],
  inventory: FanOutContentRecord[],
): FanOutOpportunity[] {
  const coverageByQuestion = new Map(coverages.map((c) => [c.questionId, c]));
  const out: FanOutOpportunity[] = [];
  for (const question of questions) {
    const coverage = coverageByQuestion.get(question.id);
    if (!coverage) continue;
    if (coverage.band === "fully-covered" && coverage.score >= 80) continue;
    const opportunity = buildFanOutOpportunity({ question, coverage, inventory });
    if (opportunity) out.push(opportunity);
  }
  return consolidateOpportunityClusters(out, inventory);
}

/** Cap founder-facing fan-out items so daily briefs stay focused. */
export const MAX_FOUNDER_FACING_FAN_OUT = 3;

export function selectFounderFacingFanOut(
  opportunities: FanOutOpportunity[],
  limit = MAX_FOUNDER_FACING_FAN_OUT,
): FanOutOpportunity[] {
  return opportunities
    .filter(
      (o) =>
        o.coverageBand !== "fully-covered" &&
        o.priorityScore >= 48 &&
        o.recommendedAction !== "no-action-needed" &&
        o.clusterRole !== "supporting-faq",
    )
    .slice(0, limit);
}

/** Top opportunities for reports — prefer flagship/distinct over supporting FAQs. */
export function selectTopReportOpportunities(
  opportunities: FanOutOpportunity[],
  limit = 10,
): FanOutOpportunity[] {
  const primary = opportunities.filter((o) => o.clusterRole !== "supporting-faq");
  const supporting = opportunities.filter((o) => o.clusterRole === "supporting-faq");
  return [...primary, ...supporting].slice(0, limit);
}
