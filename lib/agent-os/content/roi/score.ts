/**
 * Deterministic per-question Content ROI dimension scoring (0–100).
 * Uses fan-out coverage, commercial/authority, stage, family, provenance — no invented volume.
 */

import { resolveGapClusterId } from "../../search/fan-out/clusters";
import type {
  FanOutOpportunity,
  FanOutQuestion,
  QuestionCoverage,
} from "../../search/fan-out/types";
import {
  CONTENT_ROI_WEIGHTS,
  MIN_CONVERSATION_DEPTH,
  MIN_TASTE_ASSIGNMENT,
} from "./weights";
import type {
  ContentRoiDimensionKey,
  ContentRoiDimensionScores,
  ContentRoiPrimaryFormat,
  ContentRoiQuestionAssessment,
  ContentRoiScoreBreakdown,
  ContentRoiTopicKind,
  ContentRoiWeights,
} from "./types";

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function scale10(n: number): number {
  return clamp100((Math.max(1, Math.min(10, n)) / 10) * 100);
}

const STAGE_SALES: Record<FanOutQuestion["audienceStage"], number> = {
  discovering: 42,
  researching: 55,
  comparing: 72,
  selecting: 86,
  "ready-to-contact": 94,
  "post-purchase": 48,
};

const FAMILY_BRAND: Partial<Record<FanOutQuestion["queryFamily"], number>> = {
  "luxury-and-private-client": 92,
  "trust-ethics-credibility": 90,
  "jeweler-comparison": 88,
  "buying-process-anxiety": 86,
  "custom-design": 84,
  "cut-and-sparkle": 82,
  "natural-versus-lab": 80,
  "local-charlotte-intent": 78,
  "pricing-and-budgeting": 74,
  "diamond-quality": 72,
  "shapes-and-appearance": 68,
  "beginner-education": 62,
  "proposal-and-surprise": 70,
  "maintenance-repairs-ownership": 45,
};

const FAMILY_CONVERSATION: Partial<
  Record<FanOutQuestion["queryFamily"], number>
> = {
  "buying-process-anxiety": 88,
  "jeweler-comparison": 86,
  "luxury-and-private-client": 85,
  "trust-ethics-credibility": 84,
  "natural-versus-lab": 82,
  "cut-and-sparkle": 80,
  "pricing-and-budgeting": 78,
  "custom-design": 76,
  "beginner-education": 74,
  "proposal-and-surprise": 72,
  "diamond-quality": 70,
  "local-charlotte-intent": 68,
  "shapes-and-appearance": 58,
  "maintenance-repairs-ownership": 28,
};

const FAMILY_TASTE: Partial<Record<FanOutQuestion["queryFamily"], number>> = {
  "jeweler-comparison": 78,
  "luxury-and-private-client": 82,
  "pricing-and-budgeting": 72,
  "natural-versus-lab": 80,
  "trust-ethics-credibility": 70,
  "buying-process-anxiety": 68,
  "shapes-and-appearance": 65,
  "beginner-education": 55,
  "cut-and-sparkle": 58,
  "maintenance-repairs-ownership": 22,
  "custom-design": 50,
  "diamond-quality": 48,
  "local-charlotte-intent": 40,
  "proposal-and-surprise": 45,
};

const NARROW_FACT_RE =
  /\b(how often|how should i care|prongs?|cleaned|insurance|warranty|gym|pool|beach|deposit|resize|polish)\b/i;

const DEPTH_RE =
  /\b(why|should i|how do i (?:know|choose|decide)|confidence|trust|wrong|identical|rare|budget|where to buy|private|concierge|lab|natural)\b/i;

const TASTE_HOOK_RE =
  /\b(rare|dessert|subscription|theater|inventory|online vs|big box|certificate|lab vs|everything is)\b/i;

export function scoreContentRoiDimensions(
  question: FanOutQuestion,
  coverage: QuestionCoverage | undefined,
  options: {
    weights?: ContentRoiWeights;
    fanOutPriority?: number | null;
  } = {},
): ContentRoiScoreBreakdown {
  const weights = options.weights ?? CONTENT_ROI_WEIGHTS;
  const band = coverage?.band ?? "uncovered";
  const coverageScore = coverage?.score ?? 0;
  const gap = 100 - coverageScore;
  const q = question.canonicalQuestion;
  const family = question.queryFamily;
  const isNarrowFact = NARROW_FACT_RE.test(q);
  const hasDepth = DEPTH_RE.test(q);
  const tasteHook = TASTE_HOOK_RE.test(q);

  const searchDiscovery = clamp100(
    gap * 0.45 +
      scale10(question.authorityValue) * 0.25 +
      (question.source === "gsc-fixture" ? 18 : question.source === "seed-curated" ? 12 : 8) +
      (band === "uncovered" ? 12 : band === "partially-covered" ? 6 : 0) -
      (question.geography !== "unspecified" ? 0 : 0),
  );

  const salesInfluence = clamp100(
    STAGE_SALES[question.audienceStage] * 0.55 +
      scale10(question.commercialValue) * 0.35 +
      (family === "buying-process-anxiety" ||
      family === "jeweler-comparison" ||
      family === "pricing-and-budgeting" ||
      family === "luxury-and-private-client"
        ? 12
        : 0) -
      (family === "maintenance-repairs-ownership" ? 8 : 0),
  );

  const brandDifferentiation = clamp100(
    (FAMILY_BRAND[family] ?? 60) * 0.7 +
      scale10(question.authorityValue) * 0.2 +
      (hasDepth ? 8 : 0) -
      (isNarrowFact ? 18 : 0),
  );

  let conversationPotential = clamp100(
    (FAMILY_CONVERSATION[family] ?? 55) * 0.65 +
      (hasDepth ? 18 : 0) +
      scale10(question.authorityValue) * 0.15 -
      (isNarrowFact ? 35 : 0),
  );
  if (isNarrowFact) conversationPotential = Math.min(conversationPotential, 40);

  const shortFormPotential = clamp100(
    (hasDepth || tasteHook ? 72 : 55) +
      (isNarrowFact ? 12 : 8) +
      (family === "cut-and-sparkle" || family === "shapes-and-appearance" ? 10 : 0) -
      (conversationPotential < 40 ? 0 : 0),
  );

  let tastePotential = clamp100(
    (FAMILY_TASTE[family] ?? 40) * 0.7 +
      (tasteHook ? 20 : 0) +
      (family === "luxury-and-private-client" || family === "jeweler-comparison"
        ? 8
        : 0) -
      (isNarrowFact ? 30 : 0),
  );
  if (isNarrowFact) tastePotential = Math.min(tastePotential, 35);

  const evergreenValue = clamp100(
    family === "maintenance-repairs-ownership" ||
      family === "diamond-quality" ||
      family === "cut-and-sparkle" ||
      family === "pricing-and-budgeting" ||
      family === "buying-process-anxiety"
      ? 88
      : family === "proposal-and-surprise"
        ? 62
        : 78,
  );

  const crossChannelLeverage = clamp100(
    conversationPotential * 0.35 +
      shortFormPotential * 0.25 +
      brandDifferentiation * 0.2 +
      (tastePotential >= MIN_TASTE_ASSIGNMENT ? 12 : 4) +
      (isNarrowFact ? 8 : 15),
  );

  // Higher = easier / less founder effort
  const productionEfficiency = clamp100(
    isNarrowFact
      ? 82
      : conversationPotential >= MIN_CONVERSATION_DEPTH
        ? 48
        : 65 + (band === "partially-covered" ? 8 : 0),
  );

  const fanPri = options.fanOutPriority ?? null;
  const strategicUrgency = clamp100(
    gap * 0.35 +
      scale10(question.commercialValue) * 0.25 +
      (band === "uncovered" ? 18 : band === "partially-covered" ? 10 : 0) +
      (fanPri != null ? Math.min(20, fanPri / 5) : 8) +
      (resolveGapClusterId(q) ? 10 : 0) -
      (isNarrowFact && family === "maintenance-repairs-ownership" ? 12 : 0),
  );

  const dimensions: ContentRoiDimensionScores = {
    salesInfluence,
    brandDifferentiation,
    searchDiscovery,
    crossChannelLeverage,
    conversationPotential,
    strategicUrgency,
    shortFormPotential,
    evergreenValue,
    productionEfficiency,
    tastePotential,
  };

  const weightedContribution = {} as ContentRoiDimensionScores;
  let overall = 0;
  for (const key of Object.keys(weights) as ContentRoiDimensionKey[]) {
    const contrib = dimensions[key] * weights[key];
    weightedContribution[key] = clamp100(contrib);
    overall += contrib;
  }
  overall = clamp100(overall);

  const reasons: string[] = [];
  reasons.push(
    `Sales ${salesInfluence} (stage ${question.audienceStage}, commercial ${question.commercialValue}/10)`,
  );
  reasons.push(
    `Brand ${brandDifferentiation} (family ${family}); Search gap ${searchDiscovery} (coverage ${coverageScore})`,
  );
  if (conversationPotential >= MIN_CONVERSATION_DEPTH) {
    reasons.push(`Conversation depth ${conversationPotential} supports long-form`);
  } else {
    reasons.push(
      `Conversation depth ${conversationPotential} below ${MIN_CONVERSATION_DEPTH} — prefer non-Conversation formats`,
    );
  }
  if (tastePotential >= MIN_TASTE_ASSIGNMENT) {
    reasons.push(`Taste potential ${tastePotential} — optional commentary eligible`);
  }
  reasons.push(
    `Efficiency ${productionEfficiency} (higher = easier); urgency ${strategicUrgency}`,
  );

  const evidence: string[] = [
    `coverageBand=${band}`,
    `coverageScore=${coverageScore}`,
    `commercialValue=${question.commercialValue}`,
    `authorityValue=${question.authorityValue}`,
    `source=${question.source}`,
    `gapCluster=${resolveGapClusterId(q) ?? "none"}`,
  ];
  if (fanPri != null) evidence.push(`fanOutPriority=${fanPri}`);

  return {
    dimensions,
    weights: { ...weights },
    weightedContribution,
    overall,
    reasons,
    evidence,
  };
}

export function recommendFormatsForQuestion(
  question: FanOutQuestion,
  scores: ContentRoiScoreBreakdown,
): {
  primary: ContentRoiPrimaryFormat;
  supporting: ContentRoiPrimaryFormat[];
  inappropriate: ContentRoiPrimaryFormat[];
  topicKind: ContentRoiTopicKind;
} {
  const d = scores.dimensions;
  const family = question.queryFamily;
  const cluster = resolveGapClusterId(question.canonicalQuestion);
  const isMaint = family === "maintenance-repairs-ownership";
  const isLocal = family === "local-charlotte-intent";
  const isPost = question.audienceStage === "post-purchase";

  let primary: ContentRoiPrimaryFormat;
  let topicKind: ContentRoiTopicKind;
  const supporting: ContentRoiPrimaryFormat[] = [];
  const inappropriate: ContentRoiPrimaryFormat[] = [];

  if (isMaint || (isPost && d.conversationPotential < MIN_CONVERSATION_DEPTH)) {
    primary = "post-purchase-guide";
    topicKind = "post-purchase-education";
    supporting.push("faq-cluster", "carousel", "short-form-series", "newsletter");
    inappropriate.push("conversation", "a-matter-of-taste");
  } else if (isLocal && d.salesInfluence >= 70) {
    primary = "local-landing-enhancement";
    topicKind = "local-conversion";
    supporting.push("faq-cluster", "concierge-explainer", "short-form-series");
    inappropriate.push("a-matter-of-taste");
  } else if (
    d.conversationPotential >= MIN_CONVERSATION_DEPTH &&
    d.brandDifferentiation >= 70 &&
    d.crossChannelLeverage >= 60
  ) {
    primary = "conversation";
    topicKind = "standalone-high-value";
    supporting.push("short-form-series", "newsletter", "diamond-guide-flagship", "faq-cluster");
    if (d.tastePotential >= MIN_TASTE_ASSIGNMENT) {
      supporting.push("a-matter-of-taste");
    } else {
      inappropriate.push("a-matter-of-taste");
    }
  } else if (cluster === "pricing-budget-tradeoffs" || cluster === "buyer-orientation-where-to-buy") {
    primary = "diamond-guide-flagship";
    topicKind = "flagship-cluster";
    supporting.push("faq-cluster", "sales-support", "newsletter", "short-form-series");
    if (d.conversationPotential >= MIN_CONVERSATION_DEPTH) {
      supporting.push("conversation");
    }
    if (d.tastePotential < MIN_TASTE_ASSIGNMENT) {
      inappropriate.push("a-matter-of-taste");
    }
  } else if (
    d.salesInfluence >= 78 &&
    d.conversationPotential < MIN_CONVERSATION_DEPTH
  ) {
    primary = "sales-support";
    topicKind = "sales-enablement";
    supporting.push("faq-cluster", "concierge-explainer", "newsletter");
    inappropriate.push("conversation", "a-matter-of-taste");
  } else if (
    d.tastePotential >= MIN_TASTE_ASSIGNMENT &&
    d.conversationPotential < MIN_CONVERSATION_DEPTH
  ) {
    primary = "a-matter-of-taste";
    topicKind = "taste-only";
    supporting.push("short-form-series", "carousel");
    inappropriate.push("conversation");
  } else if (d.shortFormPotential >= 70 && d.conversationPotential < 50) {
    primary = "short-form-series";
    topicKind = "short-form-only";
    supporting.push("carousel", "faq-cluster");
    inappropriate.push("conversation");
  } else {
    primary = "faq-cluster";
    topicKind = "supporting-faq";
    supporting.push("newsletter", "sales-support");
    inappropriate.push("conversation", "a-matter-of-taste");
  }

  // Never assign Taste universally
  if (
    d.tastePotential < MIN_TASTE_ASSIGNMENT &&
    !inappropriate.includes("a-matter-of-taste") &&
    primary !== "a-matter-of-taste"
  ) {
    inappropriate.push("a-matter-of-taste");
  }

  return {
    primary,
    supporting: [...new Set(supporting)],
    inappropriate: [...new Set(inappropriate)],
    topicKind,
  };
}

export function assessQuestionRoi(
  question: FanOutQuestion,
  coverage: QuestionCoverage | undefined,
  fanOutOpp: FanOutOpportunity | undefined,
  weights: ContentRoiWeights = CONTENT_ROI_WEIGHTS,
): ContentRoiQuestionAssessment {
  const scores = scoreContentRoiDimensions(question, coverage, {
    weights,
    fanOutPriority: fanOutOpp?.priorityScore ?? null,
  });
  const formats = recommendFormatsForQuestion(question, scores);
  return {
    questionId: question.id,
    canonicalQuestion: question.canonicalQuestion,
    queryFamily: question.queryFamily,
    audienceStage: question.audienceStage,
    coverageScore: coverage?.score ?? 0,
    coverageBand: coverage?.band ?? "uncovered",
    commercialValue: question.commercialValue,
    authorityValue: question.authorityValue,
    gapClusterId: resolveGapClusterId(question.canonicalQuestion),
    scores,
    topicKindHint: formats.topicKind,
    primaryFormat: formats.primary,
    supportingFormats: formats.supporting,
    inappropriateFormats: formats.inappropriate,
  };
}
