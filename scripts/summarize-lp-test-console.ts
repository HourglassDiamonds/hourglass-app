import { buildLpTestRows, summarizeLpTestRows } from "../lib/calibration-library/light-performance-test-rows";
import { listCalibrationEntries } from "../lib/calibration-library/storage";

async function main() {
  const entries = await listCalibrationEntries(500);
  const rows = buildLpTestRows(entries);
  const summary = summarizeLpTestRows(rows);
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    "MISSING:",
    rows.filter((r) => r.status === "MISSING").map((r) => r.reportNumber),
  );
  console.log(
    "MISMATCH:",
    rows.filter((r) => r.scoreMismatch).map((r) => r.reportNumber),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
