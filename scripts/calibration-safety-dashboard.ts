/**
 * Phase 5 — calibration safety dashboard.
 * Run: npx tsx scripts/calibration-safety-dashboard.ts
 */
import {
  buildCalibrationSafetyDashboard,
  formatCalibrationSafetyDashboard,
} from "../lib/calibration-library/calibration-safety-dashboard";
import { listCalibrationEntries } from "../lib/calibration-library/storage";

async function main() {
  const entries = await listCalibrationEntries(500);
  const dash = buildCalibrationSafetyDashboard(entries);
  console.log(formatCalibrationSafetyDashboard(dash));
  console.log("\n--- JSON ---\n");
  console.log(
    JSON.stringify(
      {
        ...dash,
        triage: {
          unsafeCount: dash.triage.unsafeCount,
          byClassification: dash.triage.byClassification,
          byBlocker: dash.triage.byBlocker.slice(0, 12),
        },
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
