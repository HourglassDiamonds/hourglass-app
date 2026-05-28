import { computeCorpusSafetySnapshot } from "../lib/calibration-library/corpus-metrics";
import { restoreWronglyQuarantinedProductionSafe } from "../lib/calibration-library/corpus-restore-active-safe";
import { readWorkbookFile, writeWorkbookFile } from "../lib/calibration-library/workbook-file";

async function main() {
  const entries = await readWorkbookFile();
  const before = computeCorpusSafetySnapshot(entries);
  const { entries: next, restored, ids } =
    restoreWronglyQuarantinedProductionSafe(entries);
  await writeWorkbookFile(next);
  const after = computeCorpusSafetySnapshot(next);
  console.log("Before:", before.activeCorpusRecords, "active,", before.calibrationSafeActiveCorpus, "safe");
  console.log("Restored:", restored, ids);
  console.log("After:", after.activeCorpusRecords, "active,", after.calibrationSafeActiveCorpus, "safe", `(${after.calibrationSafeActiveCorpusPercent}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
