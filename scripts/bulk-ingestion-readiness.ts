/**
 * Phase 5 — bulk ingestion readiness report.
 * Run: npx tsx scripts/bulk-ingestion-readiness.ts
 */
import {
  buildBulkIngestionReadinessReport,
  formatBulkIngestionReadinessReport,
} from "../lib/calibration-library/bulk-ingestion-readiness";
import { listCalibrationEntries } from "../lib/calibration-library/storage";

async function main() {
  const entries = await listCalibrationEntries(500);
  const includeLive = process.env.CALIBRATION_READINESS_SKIP_LIVE !== "1";
  const report = await buildBulkIngestionReadinessReport(entries, {
    includeLiveAnchorAudits: includeLive,
  });
  console.log(formatBulkIngestionReadinessReport(report));
  console.log("\n--- JSON ---\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
