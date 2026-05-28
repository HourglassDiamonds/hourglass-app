import { assessCalibrationSafety } from "../lib/calibration-library/calibration-safety";
import { isCalibrationSeedOrTestArtifact } from "../lib/calibration-library/corpus-core";
import { readWorkbookFile } from "../lib/calibration-library/workbook-file";

async function main() {
  const entries = await readWorkbookFile();
  for (const e of entries) {
    if (e.corpusStatus !== "quarantined" || e.syntheticCalibration) continue;
    const s = assessCalibrationSafety(e);
    if (!s.calibrationEligible) continue;
    console.log(
      e.metadata.lab,
      e.metadata.reportNumber,
      e.parserType,
      isCalibrationSeedOrTestArtifact(e),
      e.quarantineReason?.slice(0, 60),
    );
  }
}

main();
