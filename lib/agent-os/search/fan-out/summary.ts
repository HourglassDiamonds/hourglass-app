/**
 * Executive summary + readable report formatting for fan-out coverage.
 */

import type {
  FamilyCoverageStat,
  FanOutCoverageSnapshot,
  FanOutExecutiveSummary,
  FanOutOpportunity,
  FanOutQuestion,
  QueryFamily,
  QuestionCoverage,
} from "./types";
import { QUERY_FAMILIES } from "./types";
import { selectTopReportOpportunities } from "./prioritize";

export function buildFamilyStats(
  questions: FanOutQuestion[],
  coverages: QuestionCoverage[],
): FamilyCoverageStat[] {
  const coverageById = new Map(coverages.map((c) => [c.questionId, c]));
  const stats: FamilyCoverageStat[] = [];

  for (const family of QUERY_FAMILIES) {
    const familyQuestions = questions.filter((q) => q.queryFamily === family);
    if (familyQuestions.length === 0) continue;
    let sum = 0;
    let fully = 0;
    let partial = 0;
    let uncovered = 0;
    for (const q of familyQuestions) {
      const cov = coverageById.get(q.id);
      const score = cov?.score ?? 0;
      sum += score;
      if (cov?.band === "fully-covered") fully += 1;
      else if (cov?.band === "partially-covered") partial += 1;
      else uncovered += 1;
    }
    stats.push({
      family,
      questionCount: familyQuestions.length,
      averageScore: Number((sum / familyQuestions.length).toFixed(1)),
      fullyCovered: fully,
      partiallyCovered: partial,
      uncovered,
    });
  }

  return stats;
}

export function buildFanOutExecutiveSummary(input: {
  questions: FanOutQuestion[];
  coverages: QuestionCoverage[];
  contentInventoryCount: number;
  opportunities: FanOutOpportunity[];
}): FanOutExecutiveSummary {
  const { questions, coverages, contentInventoryCount, opportunities } = input;
  let fully = 0;
  let partial = 0;
  let uncovered = 0;
  let sum = 0;
  for (const c of coverages) {
    sum += c.score;
    if (c.band === "fully-covered") fully += 1;
    else if (c.band === "partially-covered") partial += 1;
    else uncovered += 1;
  }

  const familyStats = buildFamilyStats(questions, coverages);
  const ranked = [...familyStats].sort((a, b) => b.averageScore - a.averageScore);

  return {
    totalQuestionsAnalyzed: questions.length,
    fullyCovered: fully,
    partiallyCovered: partial,
    uncovered,
    averageCoverageScore: coverages.length
      ? Number((sum / coverages.length).toFixed(1))
      : 0,
    strongestQueryFamilies: ranked.slice(0, 3),
    weakestQueryFamilies: [...ranked].reverse().slice(0, 3),
    contentInventoryCount,
    topOpportunityCount: opportunities.length,
  };
}

export function formatFanOutReport(snapshot: FanOutCoverageSnapshot): string {
  const { summary, opportunities, founderFacingOpportunities } = snapshot;
  const lines: string[] = [];
  lines.push("# AI Fan-Out Coverage Analyzer — Report");
  lines.push("");
  lines.push("## Executive summary");
  lines.push(`- Questions analyzed: ${summary.totalQuestionsAnalyzed}`);
  lines.push(`- Fully covered: ${summary.fullyCovered}`);
  lines.push(`- Partially covered: ${summary.partiallyCovered}`);
  lines.push(`- Uncovered: ${summary.uncovered}`);
  lines.push(`- Average coverage score: ${summary.averageCoverageScore}`);
  lines.push(`- Content inventory assets: ${summary.contentInventoryCount}`);
  lines.push("");
  lines.push("### Strongest query families");
  for (const f of summary.strongestQueryFamilies) {
    lines.push(
      `- ${f.family}: avg ${f.averageScore} (${f.fullyCovered} full / ${f.partiallyCovered} partial / ${f.uncovered} uncovered)`,
    );
  }
  lines.push("");
  lines.push("### Weakest query families");
  for (const f of summary.weakestQueryFamilies) {
    lines.push(
      `- ${f.family}: avg ${f.averageScore} (${f.fullyCovered} full / ${f.partiallyCovered} partial / ${f.uncovered} uncovered)`,
    );
  }
  lines.push("");
  lines.push("## Founder-facing priorities (Search Strategy surface)");
  if (founderFacingOpportunities.length === 0) {
    lines.push("- None above threshold");
  } else {
    for (const [i, opp] of founderFacingOpportunities.entries()) {
      lines.push(
        `${i + 1}. [${opp.priorityScore}] ${opp.question} (${opp.queryFamily}, score ${opp.coverageScore})`,
      );
      lines.push(`   Action: ${opp.recommendedAction} → ${opp.recommendedFormat}`);
      if (opp.suggestedExistingPage) {
        lines.push(`   Expand: ${opp.suggestedExistingPage}`);
      }
      lines.push(`   Why weak: ${opp.whyCoverageWeak[0] ?? "coverage gap"}`);
    }
  }
  lines.push("");
  lines.push("## Top 10 prioritized opportunities");
  for (const [i, opp] of selectTopReportOpportunities(opportunities, 10).entries()) {
    lines.push(
      `${i + 1}. [${opp.priorityScore}] ${opp.question}`,
    );
    lines.push(
      `   Family: ${opp.queryFamily} · Stage: ${opp.audienceStage} · Coverage: ${opp.coverageScore} (${opp.coverageBand})`,
    );
    lines.push(
      `   Action: ${opp.recommendedAction} (${opp.recommendedFormat}) · Role: ${opp.clusterRole}${opp.flagshipTitle ? ` · Flagship: ${opp.flagshipTitle}` : ""} · Commercial ${opp.commercialValue}/Authority ${opp.authorityValue}`,
    );
    if (opp.suggestedExistingPage) {
      lines.push(`   Suggested page: ${opp.suggestedExistingPage}`);
    }
    lines.push(`   Why: ${opp.whyCoverageWeak.slice(0, 2).join("; ")}`);
  }
  lines.push("");
  lines.push("## Facts");
  for (const fact of snapshot.facts) lines.push(`- ${fact}`);
  lines.push("");
  lines.push("## Inferences");
  for (const inf of snapshot.inferences) lines.push(`- ${inf}`);
  lines.push("");
  return lines.join("\n");
}

export function familyLabel(family: QueryFamily): string {
  return family.replace(/-/g, " ");
}
