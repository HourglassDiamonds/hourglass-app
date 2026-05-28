import { buildDistributionCalibrationReport } from "../lib/calibration-library/distribution-calibration";
import { buildLpTestRows } from "../lib/calibration-library/light-performance-test-rows";
import { buildCalibrationReviewReport } from "../lib/calibration-library/light-performance-calibration-review";
import { listCalibrationEntries } from "../lib/calibration-library/storage";

async function main() {
  const entries = await listCalibrationEntries(500);
  const rows = buildLpTestRows(entries);
  const report = buildCalibrationReviewReport(rows);
  const distribution = buildDistributionCalibrationReport({
    rows,
    reviews: report.reviews,
    distribution: report.distribution,
  });

  console.log("=== LP calibration review summary ===\n");
  console.log(JSON.stringify(report.distribution, null, 2));
  console.log("\nDataset health:", distribution.datasetHealthNotes);
  console.log("\nHistogram:", distribution.histogram);
  console.log("\nSynthetic:", distribution.syntheticCount);
  console.log("\nTop scoring:");
  console.log(report.topScoring);
  console.log("\nLowest scoring:");
  console.log(report.lowestScoring);
  console.log("\nSanity flags:", distribution.sanityFlags.length);
  console.log("\nReview flags (derived):", report.suspicious.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
