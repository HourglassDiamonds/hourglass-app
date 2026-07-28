/**
 * AI Fan-Out Coverage Analyzer — local inspection CLI.
 *
 * Usage:
 *   npm run agent-os:fan-out
 *   npm run agent-os:fan-out -- --json
 *   npm run agent-os:fan-out -- --universe
 *   npm run agent-os:fan-out -- --top=15
 *
 * Read-only. Writes report under tmp/agent-os/ (gitignored).
 * Does not send email, mutate production, or activate cron.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFanOutUniverseStats,
  formatFanOutAuditReport,
  formatFanOutReport,
  formatFanOutUniverseReport,
  runFanOutCoverageAnalyzer,
  selectTopReportOpportunities,
  summarizeCanonicalInventory,
  collectFixtureGscCandidates,
} from "../lib/agent-os/search/fan-out";

function parseTop(args: string[]): number {
  const flag = args.find((a) => a.startsWith("--top="));
  if (!flag) return 10;
  const n = Number(flag.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 10;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const universeOnly = args.includes("--universe");
  const top = parseTop(args);

  const universe = buildFanOutUniverseStats();
  const universeMd = formatFanOutUniverseReport(universe);

  if (universeOnly) {
    if (asJson) {
      console.log(JSON.stringify(universe, null, 2));
    } else {
      console.log(universeMd);
    }
    return;
  }

  const snapshot = runFanOutCoverageAnalyzer();
  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `fan-out-coverage-${stamp}.json`);
  const mdPath = join(outDir, `fan-out-coverage-${stamp}.md`);
  const auditPath = join(outDir, `fan-out-integrity-audit-${stamp}.md`);
  const universePath = join(outDir, `fan-out-universe-${stamp}.md`);

  const canonical = summarizeCanonicalInventory(snapshot.contentInventory);
  const uncovered = snapshot.coverages
    .filter((c) => c.band === "uncovered")
    .map((c) => {
      const q = snapshot.questions.find((x) => x.id === c.questionId);
      return {
        questionId: c.questionId,
        question: q?.canonicalQuestion ?? c.questionId,
        family: q?.queryFamily ?? null,
        score: c.score,
      };
    });

  const slim = {
    status: snapshot.status,
    universe,
    summary: snapshot.summary,
    canonicalInventory: canonical,
    founderFacingOpportunities: snapshot.founderFacingOpportunities,
    topOpportunities: selectTopReportOpportunities(snapshot.opportunities, top),
    uncoveredQuestions: uncovered,
    fixtureGscCandidates: collectFixtureGscCandidates(),
    facts: snapshot.facts,
    inferences: snapshot.inferences,
    inventoryCount: snapshot.contentInventory.length,
    questionCount: snapshot.questions.filter((q) => q.status === "active")
      .length,
  };

  const auditMd = formatFanOutAuditReport(snapshot);
  writeFileSync(jsonPath, JSON.stringify(slim, null, 2), "utf8");
  writeFileSync(
    mdPath,
    `${universeMd}\n${formatFanOutReport(snapshot)}`,
    "utf8",
  );
  writeFileSync(auditPath, auditMd, "utf8");
  writeFileSync(universePath, universeMd, "utf8");

  if (asJson) {
    console.log(JSON.stringify(slim, null, 2));
  } else {
    console.log(universeMd);
    console.log(formatFanOutReport(snapshot));
    console.log("");
    console.log(`[fan-out] wrote ${mdPath}`);
    console.log(`[fan-out] wrote ${jsonPath}`);
    console.log(`[fan-out] wrote ${universePath}`);
    console.log(`[fan-out] wrote integrity audit ${auditPath}`);
  }
}

main();
