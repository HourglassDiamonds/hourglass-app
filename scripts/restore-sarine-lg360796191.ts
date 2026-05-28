/**
 * Re-extract and restore quarantined LG360796191 Sarine anchor from live PDF.
 * Run: npx tsx scripts/restore-sarine-lg360796191.ts
 */
import { assessCalibrationInclusion } from "../lib/calibration-library/calibration-inclusion-policy";
import { assessCalibrationSafety } from "../lib/calibration-library/calibration-safety";
import { applyCorpusSaveGuardrails } from "../lib/calibration-library/corpus-save-guardrails";
import { computeCorpusSafetySnapshot } from "../lib/calibration-library/corpus-metrics";
import {
  buildActiveCorpusDistributionStressReport,
  formatActiveCorpusDistributionStressReport,
} from "../lib/calibration-library/corpus-distribution-stress";
import { runCalibrationUploadExtraction } from "../lib/calibration-library/extract-upload-pipeline";
import { listMissingFieldKeys, normalizeCalibrationFields } from "../lib/calibration-library/field-normalization";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "../lib/calibration-library/anchor-pdf-paths";
import { scoreRoundBrilliant } from "../lib/calibration-library/scoring/round-brilliant";
import type { CalibrationWorkbookEntry } from "../lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "../lib/calibration-library/types";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getCalibrationDataDir,
  readWorkbookFile,
  writeWorkbookFile,
} from "../lib/calibration-library/workbook-file";

const TARGET_REPORT = "LG360796191";
const TARGET_ID = "86ea5c09-44e9-4654-9d44-ba37fe0b3751";

const FIELD_KEYS_TO_REPORT = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
] as const;

function findTargetEntry(
  entries: CalibrationWorkbookEntry[],
): CalibrationWorkbookEntry | undefined {
  return entries.find(
    (e) =>
      e.id === TARGET_ID ||
      (e.metadata.reportNumber === TARGET_REPORT &&
        e.metadata.lab === "GCAL" &&
        e.metadata.reportSource === "pdf-upload" &&
        !e.metadata.reportNumber.includes("-")),
  );
}

async function main() {
  const entries = await readWorkbookFile();
  const beforeSnap = computeCorpusSafetySnapshot(entries);
  const entry = findTargetEntry(entries);
  if (!entry) {
    console.error(`No workbook row for ${TARGET_REPORT}`);
    process.exit(1);
  }

  const spec = ANCHOR_PDF_SPECS.find((s) => s.reportNumber === TARGET_REPORT)!;
  const pdfPath = resolveAnchorPdfPath(spec);
  if (!pdfPath) {
    console.error(`No PDF found for ${TARGET_REPORT} (hints: ${spec.filenameHints.join(", ")})`);
    process.exit(1);
  }

  console.log(`=== Restore ${TARGET_REPORT} Sarine ===\n`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Row id: ${entry.id}`);
  console.log(`Before: corpusStatus=${entry.corpusStatus}, calEligible=${entry.calibrationEligible}\n`);

  const beforeSafety = assessCalibrationSafety(entry);
  const bytes = readFileSync(pdfPath);

  const pipeline = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    lab: entry.metadata.lab,
    reportNumber: entry.metadata.reportNumber,
    reportSource: entry.metadata.reportSource,
  });

  if (pipeline.timedOut) {
    console.error("Pipeline timed out — row unchanged");
    process.exit(1);
  }

  const extractedFieldsRaw = pipeline.fields;
  const fields = pipeline.fields;
  const fieldsNormalized =
    pipeline.fieldsNormalized ?? normalizeCalibrationFields(fields);
  const fieldProvenance = pipeline.fieldProvenance;
  const valueProvenance =
    pipeline.valueProvenance ??
    Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, "extracted" as const]));

  let updated: CalibrationWorkbookEntry = {
    ...entry,
    fields,
    fieldsNormalized,
    confidence: pipeline.confidence,
    extractedFieldsRaw,
    extractedConfidence: pipeline.confidence,
    parserType: pipeline.parserType,
    parserConfidence: pipeline.parserConfidence,
    textMethod: pipeline.textMethod,
    warnings: [...pipeline.warnings],
    missingFields: listMissingFieldKeys(fields),
    roundBrilliantScore: scoreRoundBrilliant(fieldsNormalized),
    fieldProvenance,
    valueProvenance,
    parserMetadata: {
      parserType: pipeline.parserType,
      parserConfidence: pipeline.parserConfidence,
      textMethod: pipeline.textMethod,
      extractionMeta: pipeline.extractionMeta,
      fieldProvenance,
      gcalInternal: pipeline.gcalInternal,
      giaInternal: pipeline.giaInternal,
      igiInternal: pipeline.igiInternal,
    },
    updatedAt: new Date().toISOString(),
  };

  const afterSafety = assessCalibrationSafety(updated);
  updated.calibrationEligible = afterSafety.calibrationEligible;

  let restored = false;
  if (afterSafety.calibrationEligible) {
    updated = {
      ...updated,
      corpusStatus: "active",
      quarantineReason: undefined,
      excludedFromCalibrationStats: false,
      calibrationEligible: true,
      parserMetadata: {
        ...updated.parserMetadata,
        corpusStatus: "active",
        quarantineReason: undefined,
        excludedFromCalibrationStats: false,
      },
    };
    updated = applyCorpusSaveGuardrails(updated);
    restored =
      updated.corpusStatus === "active" && updated.calibrationEligible === true;
  } else {
    updated = applyCorpusSaveGuardrails({
      ...updated,
      corpusStatus: "quarantined",
      calibrationEligible: false,
      excludedFromCalibrationStats: true,
    });
  }

  const inclusion = assessCalibrationInclusion(updated);
  const nextEntries = entries.map((e) => (e.id === updated.id ? updated : e));
  await writeWorkbookFile(nextEntries);

  const afterSnap = computeCorpusSafetySnapshot(nextEntries);
  const stress = buildActiveCorpusDistributionStressReport(nextEntries);

  console.log("Recovered fields:");
  for (const k of FIELD_KEYS_TO_REPORT) {
    const v = fields[k]?.trim() || "(empty)";
    console.log(`  ${k}: ${v}`);
  }

  console.log("\nProvenance:");
  console.log(`  parserType: ${updated.parserType}`);
  console.log(`  parserConfidence: ${updated.parserConfidence}`);
  console.log(`  textMethod: ${updated.textMethod}`);
  console.log(`  usedImageOCR: ${String(updated.parserMetadata?.extractionMeta?.usedImageOCR)}`);

  console.log("\nSafety:");
  console.log(`  calibrationEligible (before): ${beforeSafety.calibrationEligible}`);
  console.log(`  calibrationEligible (after): ${afterSafety.calibrationEligible}`);
  console.log(`  restored to active: ${restored}`);
  console.log(`  includedInCalibrationStatistics: ${inclusion.includedInCalibrationStatistics}`);
  if (!afterSafety.calibrationEligible) {
    console.log(`  blockers: ${afterSafety.reasons.join("; ")}`);
    console.log(`  flags: ${afterSafety.reviewFlags.join(", ")}`);
    console.log(`  missingRequired: ${afterSafety.missingRequired.join(", ")}`);
    console.log(`  inclusion denials: ${inclusion.denialReasons.join(", ")}`);
  }

  console.log("\nCorpus:");
  console.log(
    `  active: ${beforeSnap.activeCorpusRecords} → ${afterSnap.activeCorpusRecords}`,
  );
  console.log(
    `  active safe: ${beforeSnap.calibrationSafeActiveCorpusPercent}% (${beforeSnap.calibrationSafeActiveCorpus}/${beforeSnap.activeCorpusRecords}) → ${afterSnap.calibrationSafeActiveCorpusPercent}% (${afterSnap.calibrationSafeActiveCorpus}/${afterSnap.activeCorpusRecords})`,
  );

  console.log("\n" + formatActiveCorpusDistributionStressReport(stress));

  const reportPath = join(getCalibrationDataDir(), "sarine-lg360796191-restore.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        restored,
        pdfPath,
        beforeSafety,
        afterSafety,
        inclusion,
        fields: Object.fromEntries(FIELD_KEYS_TO_REPORT.map((k) => [k, fields[k]])),
        beforeSnap,
        afterSnap,
        bandSpread: stress.bandSpread,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${reportPath}`);
  process.exit(restored ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
