/**
 * Validate seeded calibration DB: persistence, scoring reproducibility, LP readiness.
 * Run: npx tsx scripts/validate-calibration-database.ts
 */
import {
  assessLightPerformanceReadiness,
  formatReadinessSummary,
} from "../lib/calibration-library/light-performance-readiness";
import { scoreRoundBrilliant } from "../lib/calibration-library/scoring/round-brilliant";
import { listCalibrationEntries } from "../lib/calibration-library/storage";
import { isCalibrationDatabaseAvailable } from "../lib/supabase/calibration";

async function main() {
  const entries = await listCalibrationEntries(500);
  console.log(
    `Storage: ${isCalibrationDatabaseAvailable() ? "supabase" : "filesystem"}`,
  );
  console.log(`Entries loaded: ${entries.length}`);

  if (entries.length < 10) {
    console.error("FAIL: expected at least 10 seeded entries — run seed-calibration-database.ts");
    process.exit(1);
  }

  let scoreFailures = 0;
  let rawPreservationFailures = 0;

  for (const entry of entries) {
    const rescored = scoreRoundBrilliant(entry.fieldsNormalized);
    const stored = entry.roundBrilliantScore;
    if (
      stored &&
      (stored.eligible !== rescored.eligible ||
        (stored.eligible && stored.overall !== rescored.overall))
    ) {
      scoreFailures++;
      console.error(
        `Score mismatch ${entry.metadata.lab} ${entry.metadata.reportNumber}: stored=${stored.overall} rescored=${rescored.overall}`,
      );
    }

    const hasRaw = Object.values(entry.extractedFieldsRaw).some((v) => v.trim());
    if (!hasRaw) {
      rawPreservationFailures++;
    }
  }

  const readiness = assessLightPerformanceReadiness(entries);
  console.log(formatReadinessSummary(readiness));

  if (scoreFailures > 0 || rawPreservationFailures > 0) {
    console.error(
      `FAIL: scoreFailures=${scoreFailures} rawPreservationFailures=${rawPreservationFailures}`,
    );
    process.exit(1);
  }

  const parserTypes = new Set(entries.map((e) => e.parserType).filter(Boolean));
  console.log(`Parser families: ${[...parserTypes].join(", ")}`);
  console.log("Validation: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
