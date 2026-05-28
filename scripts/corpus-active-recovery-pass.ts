/**
 * Selective real-upload recovery pass (Phases 1–5).
 * Run: npx tsx scripts/corpus-active-recovery-pass.ts
 * Execute: npx tsx scripts/corpus-active-recovery-pass.ts --execute
 */
import { writeFileSync } from "fs";
import { join } from "path";
import {
  buildActiveUnsafeTriageReport,
  formatActiveUnsafeTriageReport,
} from "../lib/calibration-library/corpus-active-unsafe-triage";
import {
  buildActiveCorpusDistributionStressReport,
  formatActiveCorpusDistributionStressReport,
} from "../lib/calibration-library/corpus-distribution-stress";
import { computeCorpusSafetySnapshot } from "../lib/calibration-library/corpus-metrics";
import { restoreWronglyQuarantinedProductionSafe } from "../lib/calibration-library/corpus-restore-active-safe";
import {
  quarantineActiveCorpusArtifacts,
  runTargetedReExtractionForEntry,
} from "../lib/calibration-library/corpus-targeted-recovery";
import { buildBulkIngestionReadinessReport } from "../lib/calibration-library/bulk-ingestion-readiness";
import {
  getCalibrationDataDir,
  readWorkbookFile,
  writeWorkbookFile,
} from "../lib/calibration-library/workbook-file";
import type { CalibrationWorkbookEntry } from "../lib/calibration-library/types";

const execute = process.argv.includes("--execute");

async function main() {
  let entries = await readWorkbookFile();
  const before = computeCorpusSafetySnapshot(entries);

  console.log("=== Phase 1 — Active unsafe triage ===\n");
  const triageBefore = buildActiveUnsafeTriageReport(entries);
  console.log(formatActiveUnsafeTriageReport(triageBefore));

  console.log("\n=== Phase 2 — Recovery classification (embedded above) ===\n");
  const highRecovery = triageBefore.rows.filter(
    (r) => r.recoveryClassification === "HIGH_RECOVERY_PROBABILITY",
  );
  console.log(
    `HIGH_RECOVERY_PROBABILITY candidates: ${highRecovery.length}`,
  );
  for (const r of highRecovery) {
    console.log(`  ${r.id} ${r.lab} ${r.reportNumber}`);
  }

  const recoveryAttempts: Awaited<
    ReturnType<typeof runTargetedReExtractionForEntry>
  >["attempt"][] = [];

  if (execute) {
    console.log("\n=== Phase 3a — Quarantine active seed/test artifacts ===\n");
    const { entries: quarantinedEntries, result: qResult } =
      quarantineActiveCorpusArtifacts(entries);
    entries = quarantinedEntries;
    await writeWorkbookFile(entries);
    const { entries: restoredEntries, restored, ids: restoredIds } =
      restoreWronglyQuarantinedProductionSafe(entries);
    entries = restoredEntries;
    if (restored > 0) {
      await writeWorkbookFile(entries);
      console.log(`Restored wrongly quarantined production-safe: ${restored}`);
      console.log(`Restored IDs: ${restoredIds.join(", ")}`);
    }
    console.log(`Quarantined: ${qResult.quarantined}`);
    console.log(`IDs: ${qResult.ids.join(", ") || "(none)"}`);

    console.log("\n=== Phase 3b — Targeted re-extraction (HIGH_RECOVERY only) ===\n");
    const idToEntry = new Map(entries.map((e) => [e.id, e]));
    for (const row of highRecovery) {
      const entry = idToEntry.get(row.id);
      if (!entry) continue;
      const { entry: next, attempt } = await runTargetedReExtractionForEntry(entry);
      entries = entries.map((e) => (e.id === next.id ? next : e));
      recoveryAttempts.push(attempt);
      console.log(
        `${row.reportNumber}: promoted=${attempt.promotedToCalibrationSafe} gained=[${attempt.fieldsGained.join(", ")}] err=${attempt.error ?? "—"}`,
      );
    }
    await writeWorkbookFile(entries);
  } else {
    console.log(
      "\n(dry-run) Pass --execute to quarantine seed/test artifacts and run targeted re-extraction.\n",
    );
  }

  const afterEntries = execute ? entries : await readWorkbookFile();
  const after = computeCorpusSafetySnapshot(afterEntries);

  console.log("\n=== Phase 4 — Active corpus distribution stress ===\n");
  const stress = buildActiveCorpusDistributionStressReport(afterEntries);
  console.log(formatActiveCorpusDistributionStressReport(stress));

  console.log("\n=== Phase 5 — Readiness reassessment ===\n");
  const readiness = await buildBulkIngestionReadinessReport(afterEntries, {
    includeLiveAnchorAudits: false,
  });
  console.log("Before:");
  console.log(
    `  active-corpus safe: ${before.calibrationSafeActiveCorpusPercent}% (${before.calibrationSafeActiveCorpus}/${before.activeCorpusRecords})`,
  );
  console.log(
    `  stats-included (active): ${before.statisticsIncludedActivePercent}%`,
  );
  console.log("After:");
  console.log(
    `  active-corpus safe: ${after.calibrationSafeActiveCorpusPercent}% (${after.calibrationSafeActiveCorpus}/${after.activeCorpusRecords})`,
  );
  console.log(
    `  stats-included (active): ${after.statisticsIncludedActivePercent}%`,
  );
  console.log(
    `\nControlled production seeding: ${readiness.verdicts.controlledProductionSeeding}`,
  );
  console.log(`Live anchors: ${JSON.stringify(readiness.liveAnchors, null, 2)}`);

  const reportPath = join(
    getCalibrationDataDir(),
    "corpus-active-recovery-report.json",
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        execute,
        before,
        after,
        triageBefore,
        triageAfter: buildActiveUnsafeTriageReport(afterEntries),
        recoveryAttempts,
        stress,
        readiness: {
          verdicts: readiness.verdicts,
          liveAnchors: readiness.liveAnchors,
          corpus: readiness.corpus,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
