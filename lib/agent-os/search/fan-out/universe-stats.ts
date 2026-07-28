/**
 * Universe distribution / inspection helpers for CLI and tests.
 */

import {
  AUDIENCE_STAGES,
  QUERY_FAMILIES,
  QUESTION_SOURCES,
  QUESTION_STATUSES,
  type AudienceStage,
  type FanOutQuestion,
  type QueryFamily,
  type QuestionSource,
  type QuestionStatus,
} from "./types";
import {
  FAN_OUT_SEED_QUESTIONS,
  getActiveFanOutQuestions,
} from "./seed-questions";

export type CountRow<T extends string> = { key: T; count: number };

export type FanOutUniverseStats = {
  totalSeedRows: number;
  activeCanonical: number;
  duplicates: number;
  deferred: number;
  rejected: number;
  draft: number;
  deprecated: number;
  candidateAliasCount: number;
  byFamily: CountRow<QueryFamily>[];
  byStage: CountRow<AudienceStage>[];
  byGeography: CountRow<string>[];
  byProvenance: CountRow<QuestionSource>[];
  byStatus: CountRow<QuestionStatus>[];
  commercialTiers: { low: number; mid: number; high: number };
  authorityTiers: { low: number; mid: number; high: number };
  familiesMissingActive: QueryFamily[];
  underrepresentedFamilies: QueryFamily[];
  overrepresentedFamilies: QueryFamily[];
};

function countBy<T extends string>(
  keys: readonly T[],
  items: FanOutQuestion[],
  pick: (q: FanOutQuestion) => T | string,
): CountRow<T>[] {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, 0);
  for (const item of items) {
    const key = pick(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({
    key: key as T,
    count,
  }));
}

function tier(n: number): "low" | "mid" | "high" {
  if (n <= 4) return "low";
  if (n <= 7) return "mid";
  return "high";
}

export function buildFanOutUniverseStats(
  questions: FanOutQuestion[] = FAN_OUT_SEED_QUESTIONS,
): FanOutUniverseStats {
  const active = getActiveFanOutQuestions(questions);
  const byFamily = countBy(QUERY_FAMILIES, active, (q) => q.queryFamily);
  const avg =
    byFamily.reduce((s, r) => s + r.count, 0) / Math.max(1, byFamily.length);
  const underrepresentedFamilies = byFamily
    .filter((r) => r.count < avg * 0.65)
    .map((r) => r.key);
  const overrepresentedFamilies = byFamily
    .filter((r) => r.count > avg * 1.4)
    .map((r) => r.key);

  const commercialTiers = { low: 0, mid: 0, high: 0 };
  const authorityTiers = { low: 0, mid: 0, high: 0 };
  for (const q of active) {
    commercialTiers[tier(q.commercialValue)] += 1;
    authorityTiers[tier(q.authorityValue)] += 1;
  }

  const byGeographyMap = new Map<string, number>();
  for (const q of active) {
    byGeographyMap.set(q.geography, (byGeographyMap.get(q.geography) ?? 0) + 1);
  }

  return {
    totalSeedRows: questions.length,
    activeCanonical: active.length,
    duplicates: questions.filter((q) => q.status === "duplicate").length,
    deferred: questions.filter((q) => q.status === "deferred").length,
    rejected: questions.filter((q) => q.status === "rejected").length,
    draft: questions.filter((q) => q.status === "draft").length,
    deprecated: questions.filter((q) => q.status === "deprecated").length,
    candidateAliasCount: questions.reduce(
      (s, q) => s + (q.aliases?.length ?? 0),
      0,
    ),
    byFamily,
    byStage: countBy(AUDIENCE_STAGES, active, (q) => q.audienceStage),
    byGeography: [...byGeographyMap.entries()].map(([key, count]) => ({
      key,
      count,
    })),
    byProvenance: countBy(QUESTION_SOURCES, questions, (q) => q.source),
    byStatus: countBy(QUESTION_STATUSES, questions, (q) => q.status),
    commercialTiers,
    authorityTiers,
    familiesMissingActive: byFamily.filter((r) => r.count === 0).map((r) => r.key),
    underrepresentedFamilies,
    overrepresentedFamilies,
  };
}

export function formatFanOutUniverseReport(
  stats: FanOutUniverseStats = buildFanOutUniverseStats(),
): string {
  const lines: string[] = [];
  lines.push("# Fan-Out Question Universe — Inspection");
  lines.push("");
  lines.push(`- Total seed rows: ${stats.totalSeedRows}`);
  lines.push(`- Active canonical: ${stats.activeCanonical}`);
  lines.push(`- Duplicates: ${stats.duplicates}`);
  lines.push(`- Deferred: ${stats.deferred}`);
  lines.push(`- Rejected: ${stats.rejected}`);
  lines.push(`- Draft: ${stats.draft}`);
  lines.push(`- Deprecated: ${stats.deprecated}`);
  lines.push(`- Alias phrasings on rows: ${stats.candidateAliasCount}`);
  lines.push("");
  lines.push("## By query family (active)");
  for (const row of stats.byFamily) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push("");
  lines.push("## By audience stage (active)");
  for (const row of stats.byStage) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push("");
  lines.push("## By geography (active)");
  for (const row of stats.byGeography) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push("");
  lines.push("## By provenance (all statuses)");
  for (const row of stats.byProvenance.filter((r) => r.count > 0)) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  lines.push("");
  lines.push("## Commercial / authority tiers (active)");
  lines.push(
    `- Commercial low/mid/high: ${stats.commercialTiers.low}/${stats.commercialTiers.mid}/${stats.commercialTiers.high}`,
  );
  lines.push(
    `- Authority low/mid/high: ${stats.authorityTiers.low}/${stats.authorityTiers.mid}/${stats.authorityTiers.high}`,
  );
  if (stats.underrepresentedFamilies.length) {
    lines.push("");
    lines.push(
      `Underrepresented families: ${stats.underrepresentedFamilies.join(", ")}`,
    );
  }
  if (stats.overrepresentedFamilies.length) {
    lines.push(
      `Overrepresented families: ${stats.overrepresentedFamilies.join(", ")}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
