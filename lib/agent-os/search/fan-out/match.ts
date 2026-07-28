/**
 * Deterministic question ↔ content matching for fan-out coverage.
 * Order: structured metadata → topic/entity tags → normalized term matching.
 *
 * Integrity rules:
 * - Topic/entity-only hits cannot become strong matches.
 * - Weak body-support thresholds are raised to reduce false "direct answer" credit.
 * - Matches are deduped by canonicalSourceId (best evidence per underlying page).
 */

import { jaccard, normalizeText, termOverlapRatio, uniqueTokens } from "./normalize";
import type { ContentMatch, FanOutContentRecord, FanOutQuestion, MatchStrength } from "./types";

export type MatchQuestionOptions = {
  /** Max matches retained per question (ranked). */
  maxMatches?: number;
  /** Minimum match score to keep (0–1). */
  minScore?: number;
};

function strengthFromScore(score: number): MatchStrength {
  if (score >= 0.62) return "strong";
  if (score >= 0.38) return "moderate";
  return "weak";
}

function topicEntityOverlap(
  question: FanOutQuestion,
  content: FanOutContentRecord,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const qTopics = new Set(question.topics.map(normalizeText));
  const qEntities = new Set(question.entities.map(normalizeText));
  const cTopics = new Set(content.topics.map(normalizeText));
  const cEntities = new Set(content.entities.map(normalizeText));

  let hits = 0;
  let total = 0;
  for (const t of qTopics) {
    total += 1;
    if (cTopics.has(t) || [...cTopics].some((ct) => ct.includes(t) || t.includes(ct))) {
      hits += 1;
      reasons.push(`Topic tag overlap: ${t}`);
    }
  }
  for (const e of qEntities) {
    total += 1;
    if (cEntities.has(e) || [...cEntities].some((ce) => ce.includes(e) || e.includes(ce))) {
      hits += 1;
      reasons.push(`Entity tag overlap: ${e}`);
    }
  }

  const family = normalizeText(question.queryFamily.replace(/-/g, " "));
  if (
    content.topics.some((t) => normalizeText(t).includes(family.split(" ")[0] ?? "")) ||
    content.searchableText.includes(normalizeText(question.queryFamily))
  ) {
    hits += 0.5;
    total += 0.5;
    reasons.push(`Query-family affinity: ${question.queryFamily}`);
  }

  const score = total === 0 ? 0 : Math.min(1, hits / total);
  return { score, reasons: reasons.slice(0, 4) };
}

function structuredMetadataBoost(
  question: FanOutQuestion,
  content: FanOutContentRecord,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const qNorm = normalizeText(question.canonicalQuestion);

  if (
    (content.contentType === "faq" || content.contentType === "approach-qa") &&
    (normalizeText(content.title) === qNorm ||
      jaccard(uniqueTokens(content.title), uniqueTokens(question.canonicalQuestion)) >= 0.72)
  ) {
    score = 1;
    reasons.push(`Direct Q&A title match on ${content.contentType}`);
    return { score, reasons };
  }

  if (content.contentType === "faq" || content.contentType === "approach-qa") {
    const titleJac = jaccard(
      uniqueTokens(content.title),
      uniqueTokens(question.canonicalQuestion),
    );
    if (titleJac >= 0.55) {
      score = Math.max(score, 0.55 + titleJac * 0.35);
      reasons.push(`Structured Q&A title similarity (${titleJac.toFixed(2)})`);
    }
    const bodyJac = jaccard(
      uniqueTokens(question.canonicalQuestion),
      uniqueTokens(content.summary),
    );
    const bodyTerms = termOverlapRatio(question.matchTerms, content.summary);
    // Raised thresholds — mention-level overlap must not look like a direct answer
    if (bodyJac >= 0.48 || bodyTerms.ratio >= 0.55) {
      score = Math.max(score, 0.48 + Math.max(bodyJac, bodyTerms.ratio) * 0.3);
      reasons.push(
        `Structured answer-body support (${Math.max(bodyJac, bodyTerms.ratio).toFixed(2)})`,
      );
    }
  }

  if (content.contentType === "diamond-guide-article") {
    const titleJac = jaccard(
      uniqueTokens(content.title),
      uniqueTokens(question.canonicalQuestion),
    );
    if (titleJac >= 0.55) {
      score = Math.max(score, 0.5 + titleJac * 0.4);
      reasons.push(`Guide title similarity (${titleJac.toFixed(2)})`);
    }
    const summaryJac = jaccard(
      uniqueTokens(question.canonicalQuestion),
      uniqueTokens(content.summary),
    );
    const summaryTerms = termOverlapRatio(question.matchTerms, content.summary);
    if (summaryJac >= 0.4 || summaryTerms.ratio >= 0.5) {
      score = Math.max(score, 0.5 + Math.max(summaryJac, summaryTerms.ratio) * 0.35);
      reasons.push(
        `Guide summary support (${Math.max(summaryJac, summaryTerms.ratio).toFixed(2)})`,
      );
    }
  }

  const localQuestion =
    question.searchIntent === "local" ||
    question.queryFamily === "local-charlotte-intent" ||
    question.geography === "charlotte" ||
    question.geography === "waxhaw" ||
    question.geography === "charlotte-metro";

  if (
    localQuestion &&
    (content.contentType === "faq" ||
      content.contentType === "diamond-guide-article" ||
      content.contentType === "local-landing" ||
      content.contentType === "core-page")
  ) {
    const summary = normalizeText(content.summary + " " + content.title);
    const geoTerms = [
      ...question.entities,
      ...question.matchTerms,
      question.geography,
    ]
      .map(normalizeText)
      .filter((t) =>
        ["waxhaw", "charlotte", "ballantyne", "weddington", "marvin", "fort mill"].some(
          (g) => t.includes(g) || g.includes(t),
        ),
      );
    const geoHit = geoTerms.some((g) => summary.includes(g));
    if (
      geoHit &&
      (content.geography === "charlotte" ||
        content.geography === "waxhaw" ||
        content.geography === "charlotte-metro")
    ) {
      score = Math.max(score, 0.58);
      reasons.push("Local-service content names the question geography");
    }
  }

  if (
    question.geography !== "unspecified" &&
    question.geography !== "national" &&
    (content.geography === question.geography ||
      (question.geography === "waxhaw" && content.geography === "charlotte-metro") ||
      (question.geography === "charlotte" &&
        (content.geography === "charlotte-metro" || content.geography === "charlotte")))
  ) {
    // Geography alone is a small boost — never the primary match signal
    if (score >= 0.35 || reasons.length > 0) {
      score = Math.min(1, score + 0.06);
      reasons.push(`Local geography alignment: ${content.geography}`);
    }
  }

  return { score: Math.min(1, score), reasons };
}

function termMatchScore(
  question: FanOutQuestion,
  content: FanOutContentRecord,
): { score: number; reasons: string[] } {
  const haystack = content.searchableText;
  const { ratio, matched } = termOverlapRatio(question.matchTerms, haystack);
  const reasons: string[] = [];
  if (matched.length > 0) {
    reasons.push(`Matched terms: ${matched.slice(0, 5).join(", ")}`);
  }
  const tokenJac = jaccard(
    uniqueTokens(question.canonicalQuestion),
    uniqueTokens(haystack),
  );
  if (tokenJac >= 0.28) {
    reasons.push(`Question-token overlap ${tokenJac.toFixed(2)}`);
  }
  const score = Math.min(1, ratio * 0.75 + tokenJac * 0.45);
  return { score, reasons: reasons.slice(0, 4) };
}

/**
 * Score a single content record against a question with explainable reasons.
 */
export function scoreContentMatch(
  question: FanOutQuestion,
  content: FanOutContentRecord,
): ContentMatch | null {
  const structured = structuredMetadataBoost(question, content);
  const tags = topicEntityOverlap(question, content);
  const terms = termMatchScore(question, content);

  let score = Math.min(
    1,
    structured.score * 0.5 + tags.score * 0.25 + terms.score * 0.35,
  );

  // Topic/entity-only mentions cannot become strong/moderate coverage evidence
  const substantive = Math.max(structured.score, terms.score);
  if (substantive < 0.35 && tags.score >= 0.4) {
    score = Math.min(score, 0.34);
  }

  // Broad page mention without structured or term substance stays weak
  if (structured.score < 0.35 && terms.score < 0.35) {
    score = Math.min(score, 0.36);
  }

  const reasons = [...structured.reasons, ...tags.reasons, ...terms.reasons];
  if (score < 0.28 || reasons.length === 0) return null;

  return {
    contentId: content.id,
    strength: strengthFromScore(score),
    score: Number(score.toFixed(3)),
    reasons: reasons.slice(0, 6),
  };
}

/** Keep the strongest match per underlying canonical source. */
export function dedupeMatchesByCanonicalSource(
  matches: ContentMatch[],
  inventory: FanOutContentRecord[],
): ContentMatch[] {
  const byId = new Map(inventory.map((c) => [c.id, c]));
  const bestByCanonical = new Map<string, ContentMatch>();
  for (const match of matches) {
    const content = byId.get(match.contentId);
    const key = content?.canonicalSourceId ?? match.contentId;
    const existing = bestByCanonical.get(key);
    if (!existing || match.score > existing.score) {
      bestByCanonical.set(key, match);
    }
  }
  return [...bestByCanonical.values()].sort((a, b) => b.score - a.score);
}

/**
 * Match a question against the content inventory.
 */
export function matchQuestionToContent(
  question: FanOutQuestion,
  inventory: FanOutContentRecord[],
  options: MatchQuestionOptions = {},
): ContentMatch[] {
  const maxMatches = options.maxMatches ?? 6;
  const minScore = options.minScore ?? 0.32;
  const matches: ContentMatch[] = [];

  for (const content of inventory) {
    const match = scoreContentMatch(question, content);
    if (!match || match.score < minScore) continue;
    matches.push(match);
  }

  return dedupeMatchesByCanonicalSource(matches, inventory).slice(0, maxMatches);
}

/** True when match reasons indicate a genuine direct Q&A / title answer. */
export function matchLooksLikeDirectAnswer(match: ContentMatch): boolean {
  return match.reasons.some(
    (r) =>
      r.startsWith("Direct Q&A title match") ||
      /^Structured Q&A title similarity \((0\.[6-9]|1\.00)/.test(r) ||
      /^Guide title similarity \((0\.[7-9]|1\.00)/.test(r) ||
      /^Structured answer-body support \((0\.[6-9]|1\.00)/.test(r),
  );
}
