/**
 * Phase 2 — rehydrate provenance/safety on real uploaded records (no re-score / no re-upload).
 * Run: npm run rehydrate:calibration-corpus
 */
import { applyRehydrateBatch } from "../lib/calibration-library/corpus-rehydrate";
import { computeCorpusSafetySnapshot } from "../lib/calibration-library/corpus-metrics";
import {
  readWorkbookFile,
  writeWorkbookFile,
} from "../lib/calibration-library/workbook-file";

async function main() {
  const entries = await readWorkbookFile();
  const before = computeCorpusSafetySnapshot(entries);

  const { entries: next, result } = applyRehydrateBatch(entries);
  await writeWorkbookFile(next);

  const after = computeCorpusSafetySnapshot(next);

  console.log("=== Calibration corpus rehydrate ===\n");
  console.log("Before:");
  console.log(
    `  active-corpus safe: ${before.calibrationSafeActiveCorpusPercent}% (${before.calibrationSafeActiveCorpus}/${before.activeCorpusRecords})`,
  );
  console.log(
    `  stats-included (active): ${before.statisticsIncludedActivePercent}%`,
  );

  console.log("\nRehydrate:");
  console.log(`  examined: ${result.examined}`);
  console.log(`  updated: ${result.rehydrated}`);
  console.log(`  skipped: ${result.skipped}`);
  console.log("  skip reasons:", result.skippedReasons);
  console.log("\nAffected IDs:", result.affectedIds.join(", ") || "(none)");

  console.log("\nAfter:");
  console.log(
    `  active-corpus safe: ${after.calibrationSafeActiveCorpusPercent}% (${after.calibrationSafeActiveCorpus}/${after.activeCorpusRecords})`,
  );
  console.log(
    `  stats-included (active): ${after.statisticsIncludedActivePercent}%`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
