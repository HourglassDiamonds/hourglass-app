/**
 * Phase 1–2 — unsafe non-synthetic record triage + classification.
 * Run: npx tsx scripts/corpus-unsafe-triage.ts
 */
import {
  buildCorpusUnsafeTriageReport,
  formatCorpusUnsafeTriageReport,
} from "../lib/calibration-library/corpus-unsafe-triage";
import { listCalibrationEntries } from "../lib/calibration-library/storage";

async function main() {
  const entries = await listCalibrationEntries(500);
  const report = buildCorpusUnsafeTriageReport(entries);
  console.log(formatCorpusUnsafeTriageReport(report));
  console.log("\n--- JSON (summary) ---\n");
  console.log(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        nonSyntheticTotal: report.nonSyntheticTotal,
        safeCount: report.safeCount,
        unsafeCount: report.unsafeCount,
        byClassification: report.byClassification,
        byBlocker: report.byBlocker.map((g) => ({
          blocker: g.blocker,
          count: g.count,
          labs: g.labs,
          parserFamilies: g.parserFamilies,
        })),
        rows: report.rows,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
