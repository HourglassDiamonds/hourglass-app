/**
 * Seed controlled calibration records from fixtures (no live PDF/OCR).
 * Run: npx tsx scripts/seed-calibration-database.ts
 * Force re-seed: CALIBRATION_SEED_FORCE=1 npx tsx scripts/seed-calibration-database.ts
 */
import { extractFieldsFromReportText } from "../lib/calibration-library/extract-from-text";
import { buildCalibrationSeedScenarios } from "../lib/calibration-library/seed-scenarios";
import {
  extractionResultToSnapshot,
  findCalibrationEntry,
  saveCalibrationEntry,
  seedSyntheticCalibrationFixtures,
} from "../lib/calibration-library/storage";
import { isCalibrationDatabaseAvailable } from "../lib/supabase/calibration";

const force = process.env.CALIBRATION_SEED_FORCE === "1";

async function main() {
  const scenarios = buildCalibrationSeedScenarios();
  let created = 0;
  let skipped = 0;
  let updated = 0;
  const errors: string[] = [];

  console.log(
    `Calibration seed — storage: ${isCalibrationDatabaseAvailable() ? "supabase" : "filesystem"} (${scenarios.length} scenarios)`,
  );

  for (const scenario of scenarios) {
    const result = extractFieldsFromReportText(scenario.text, {
      lab: scenario.lab,
      reportNumber: scenario.reportNumber,
      reportSource: scenario.reportSource,
      stoneType: scenario.stoneType,
      textMethod: scenario.textMethod,
      pdfTextLayerLength: scenario.textMethod === "pdf-text" ? 500 : 0,
    });

    const metadata = {
      ...result.metadata,
      lab: scenario.lab,
      reportNumber: scenario.reportNumber,
      reportSource: scenario.reportSource,
      stoneType: scenario.stoneType,
    };

    const existing = await findCalibrationEntry(metadata);
    if (existing?.seeded && !force) {
      skipped++;
      continue;
    }

    const save = await saveCalibrationEntry({
      metadata,
      fields: result.fields,
      confidence: result.confidence,
      extractionSnapshot: extractionResultToSnapshot(result),
      sourceFilename: scenario.sourceFilename,
      reviewerNote: `seed:${scenario.id}`,
      saveMode: existing ? "update" : "create",
      seeded: true,
      replaceExtractionSnapshot: force || !existing?.seeded,
    });

    if (!save.ok) {
      errors.push(`${scenario.id}: ${save.message}`);
      continue;
    }

    if (save.created) created++;
    else updated++;
  }

  console.log(`Parser scenarios — created: ${created}, updated: ${updated}, skipped: ${skipped}`);

  const synthetic = await seedSyntheticCalibrationFixtures({ force });
  console.log(
    `Synthetic calibration — created: ${synthetic.created}, updated: ${synthetic.updated}, skipped: ${synthetic.skipped}`,
  );
  errors.push(...synthetic.errors);

  if (errors.length) {
    console.error("Errors:", errors.join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
