/**
 * Content ROI Prioritization — local inspection CLI.
 *
 * Usage:
 *   npm run agent-os:content-roi
 *   npm run agent-os:content-roi -- --json
 *   npm run agent-os:content-roi -- --top=15
 *
 * Read-only. Writes report under tmp/agent-os/ (gitignored).
 * Does not send email, mutate production, or activate cron.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatContentRoiReport,
  runContentRoiPrioritizer,
} from "../lib/agent-os/content/roi";

function parseTop(args: string[]): number {
  const flag = args.find((a) => a.startsWith("--top="));
  if (!flag) return 10;
  const n = Number(flag.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 10;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const top = parseTop(args);

  const snapshot = runContentRoiPrioritizer();
  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `content-roi-${stamp}.json`);
  const mdPath = join(outDir, `content-roi-${stamp}.md`);

  const slim = {
    status: snapshot.status,
    weights: snapshot.weights,
    editorialSequenceNote: snapshot.editorialSequenceNote,
    reservedCycles: snapshot.reservedCycles,
    reserveBacklogTopics: snapshot.reserveBacklogTopics,
    top10Packages: snapshot.top10Packages.slice(0, top),
    top25Topics: snapshot.top25Topics,
    postSequenceOrder: snapshot.postSequenceOrder.slice(0, 25),
    founderFacingPackages: snapshot.founderFacingPackages,
    faqOnly: snapshot.faqOnly.map((q) => q.canonicalQuestion),
    salesSupportOnly: snapshot.salesSupportOnly.map((q) => q.canonicalQuestion),
    lowRoiUncovered: snapshot.lowRoiUncovered.map((q) => ({
      question: q.canonicalQuestion,
      roi: q.scores.overall,
    })),
    evidenceNeeded: snapshot.evidenceNeeded.map((q) => q.canonicalQuestion),
    backlogCandidates: snapshot.backlogCandidates,
  };

  const md = formatContentRoiReport(snapshot);
  writeFileSync(jsonPath, JSON.stringify(slim, null, 2), "utf8");
  writeFileSync(mdPath, md, "utf8");

  if (asJson) {
    console.log(JSON.stringify(slim, null, 2));
  } else {
    console.log(md);
    console.log("");
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${mdPath}`);
  }
}

main();
