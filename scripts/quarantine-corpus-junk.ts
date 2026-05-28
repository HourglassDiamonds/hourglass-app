/**
 * Phase 1 — quarantine junk/stale calibration workbook rows (no deletes).
 * Run: npm run quarantine:corpus-junk
 */
import { applyQuarantineBatch } from "../lib/calibration-library/corpus-quarantine";
import { computeCorpusSafetySnapshot } from "../lib/calibration-library/corpus-metrics";
import {
  readWorkbookFile,
  writeWorkbookFile,
} from "../lib/calibration-library/workbook-file";

async function main() {
  const entries = await readWorkbookFile();
  const before = computeCorpusSafetySnapshot(entries);

  const { entries: next, result } = applyQuarantineBatch(entries);
  await writeWorkbookFile(next);

  const after = computeCorpusSafetySnapshot(next);

  console.log("=== Corpus junk quarantine ===\n");
  console.log("Before:");
  console.log(
    `  non-synthetic safe: ${before.calibrationSafeNonSyntheticPercent}% (${before.calibrationSafeNonSynthetic}/${before.nonSyntheticRecords})`,
  );
  console.log(
    `  active-corpus safe: ${before.calibrationSafeActiveCorpusPercent}% (${before.calibrationSafeActiveCorpus}/${before.activeCorpusRecords})`,
  );
  console.log(`  quarantined: ${before.quarantinedRecords}\n`);

  console.log("Quarantine actions:");
  console.log(`  examined: ${result.examined}`);
  console.log(`  newly quarantined: ${result.newlyQuarantined}`);
  console.log(`  already quarantined: ${result.alreadyQuarantined}`);
  console.log(`  skipped synthetic: ${result.skippedSynthetic}`);
  console.log(`  runtime_dup_test: ${result.reasons.runtime_dup_test_artifact}`);
  console.log(
    `  incomplete_core: ${result.reasons.incomplete_core_proportions}`,
  );
  console.log("\nAffected IDs:");
  for (const id of result.affectedIds) {
    const row = next.find((e) => e.id === id);
    console.log(
      `  ${id} · ${row?.metadata.lab} ${row?.metadata.reportNumber} · ${row?.quarantineReason}`,
    );
  }

  console.log("\nAfter:");
  console.log(
    `  non-synthetic safe: ${after.calibrationSafeNonSyntheticPercent}% (${after.calibrationSafeNonSynthetic}/${after.nonSyntheticRecords})`,
  );
  console.log(
    `  active-corpus safe: ${after.calibrationSafeActiveCorpusPercent}% (${after.calibrationSafeActiveCorpus}/${after.activeCorpusRecords})`,
  );
  console.log(`  quarantined: ${after.quarantinedRecords}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
