/**
 * Human-readable integrity audit report for fan-out coverage scoring.
 */

import { summarizeCanonicalInventory } from "./canonical";
import { selectTopReportOpportunities } from "./prioritize";
import type {
  FanOutCoverageSnapshot,
  FanOutOpportunity,
  QuestionCoverage,
} from "./types";

function opportunityFor(
  questionId: string,
  opportunities: FanOutOpportunity[],
): FanOutOpportunity | undefined {
  return opportunities.find((o) => o.questionId === questionId);
}

function renderQuestionBlock(input: {
  coverage: QuestionCoverage;
  snapshot: FanOutCoverageSnapshot;
  indexLabel: string;
}): string {
  const { coverage, snapshot, indexLabel } = input;
  const question = snapshot.questions.find((q) => q.id === coverage.questionId);
  const byId = new Map(snapshot.contentInventory.map((c) => [c.id, c]));
  const opp = opportunityFor(coverage.questionId, snapshot.opportunities);
  const lines: string[] = [];
  lines.push(`### ${indexLabel}. ${question?.canonicalQuestion ?? coverage.questionId}`);
  lines.push("");
  lines.push(`- **Query family:** ${question?.queryFamily ?? "n/a"}`);
  lines.push(`- **Audience stage:** ${question?.audienceStage ?? "n/a"}`);
  lines.push(`- **Coverage score / band:** ${coverage.score} / ${coverage.band}`);
  if (opp) {
    lines.push(
      `- **Recommendation:** ${opp.recommendedAction} (${opp.recommendedFormat}) · priority ${opp.priorityScore}`,
    );
    if (opp.flagshipTitle) {
      lines.push(
        `- **Gap cluster:** ${opp.gapClusterId} · role ${opp.clusterRole} · flagship “${opp.flagshipTitle}”`,
      );
    }
    if (opp.suggestedExistingPage) {
      lines.push(`- **Suggested page:** ${opp.suggestedExistingPage}`);
    }
  } else {
    lines.push("- **Recommendation:** none (fully covered or suppressed)");
  }
  lines.push("");
  lines.push("**Matched assets**");
  if (coverage.matches.length === 0) {
    lines.push("- _(none)_");
  } else {
    for (const match of coverage.matches) {
      const content = byId.get(match.contentId);
      lines.push(
        `- **${content?.title ?? match.contentId}** — \`${content?.url ?? "?"}\` (${content?.contentType ?? "?"})`,
      );
      lines.push(
        `  - Canonical source: \`${content?.canonicalSourceId ?? "?"}\` · match ${match.score} (${match.strength})`,
      );
      lines.push(`  - Match reasons: ${match.reasons.join("; ") || "n/a"}`);
      lines.push(
        `  - Topics: ${(content?.topics ?? []).join(", ") || "n/a"} · Entities: ${(content?.entities ?? []).join(", ") || "n/a"}`,
      );
      lines.push(
        `  - Structured data: ${content?.hasStructuredData ? "yes" : "no"} · Summary: ${(content?.summary ?? "").slice(0, 140)}…`,
      );
    }
  }
  lines.push("");
  lines.push("**Coverage factors**");
  for (const f of coverage.factors) {
    lines.push(
      `- ${f.label} (w=${f.weight}): **${f.score}** — ${f.reason}`,
    );
  }
  lines.push("");
  lines.push("**Explanation**");
  for (const r of coverage.reasons) {
    lines.push(`- ${r}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Build a readable audit covering fully / partial / uncovered samples.
 */
export function formatFanOutAuditReport(
  snapshot: FanOutCoverageSnapshot,
): string {
  const sorted = [...snapshot.coverages].sort((a, b) => b.score - a.score);
  const full = sorted.filter((c) => c.band === "fully-covered");
  const partial = sorted.filter((c) => c.band === "partially-covered");
  const uncovered = sorted.filter((c) => c.band === "uncovered");
  const canonical = summarizeCanonicalInventory(snapshot.contentInventory);
  const top = selectTopReportOpportunities(snapshot.opportunities, 10);

  const lines: string[] = [];
  lines.push("# AI Fan-Out Coverage — Scoring Integrity Audit");
  lines.push("");
  lines.push("## Snapshot summary");
  lines.push(`- Questions analyzed: ${snapshot.summary.totalQuestionsAnalyzed}`);
  lines.push(`- Fully covered: ${snapshot.summary.fullyCovered}`);
  lines.push(`- Partially covered: ${snapshot.summary.partiallyCovered}`);
  lines.push(`- Uncovered: ${snapshot.summary.uncovered}`);
  lines.push(`- Average coverage score: ${snapshot.summary.averageCoverageScore}`);
  lines.push(
    `- Inventory: ${canonical.totalNormalizedRecords} normalized records · ${canonical.uniqueCanonicalAssets} unique canonical sources · ${canonical.derivativeRecordCount} derivatives`,
  );
  lines.push("");
  lines.push("### Crowded canonical sources (derivatives)");
  for (const row of canonical.topCrowdedSources.slice(0, 10)) {
    lines.push(`- \`${row.canonicalSourceId}\`: ${row.recordCount} records`);
  }
  lines.push("");

  lines.push("## Sample — fully covered (top 5 by score)");
  lines.push("");
  if (full.length === 0) {
    lines.push("_No fully covered questions after gating._");
    lines.push("");
  } else {
    full.slice(0, 5).forEach((c, i) => {
      lines.push(
        renderQuestionBlock({ coverage: c, snapshot, indexLabel: String(i + 1) }),
      );
    });
  }

  lines.push("## Sample — partially covered (5)");
  lines.push("");
  partial.slice(0, 5).forEach((c, i) => {
    lines.push(
      renderQuestionBlock({ coverage: c, snapshot, indexLabel: String(i + 1) }),
    );
  });

  lines.push("## All uncovered questions");
  lines.push("");
  if (uncovered.length === 0) {
    lines.push("_None._");
    lines.push("");
  } else {
    uncovered.forEach((c, i) => {
      lines.push(
        renderQuestionBlock({ coverage: c, snapshot, indexLabel: String(i + 1) }),
      );
    });
  }

  lines.push("## Top 10 opportunities (supporting FAQs demoted)");
  lines.push("");
  top.forEach((o, i) => {
    lines.push(
      `${i + 1}. [${o.priorityScore}] ${o.question} — ${o.recommendedAction} (${o.clusterRole}${o.flagshipTitle ? `: ${o.flagshipTitle}` : ""}) · coverage ${o.coverageScore}`,
    );
  });
  lines.push("");
  return lines.join("\n");
}
