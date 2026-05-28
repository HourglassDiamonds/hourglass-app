/**
 * Audit: ensure the same PDF produces the same normalized fields across entry paths.
 * Run: npm run audit:upload-vs-anchor-parity
 */
import { readFileSync } from "fs";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
  type AnchorPdfSpec,
} from "../lib/calibration-library/anchor-pdf-paths";
import { ANCHOR_FIELD_TARGETS } from "../lib/calibration-library/anchor-field-targets";
import { buildLiveAnchorExtractionAudit } from "../lib/calibration-library/anchor-live-audit";
import { runCalibrationUploadExtraction } from "../lib/calibration-library/extract-upload-pipeline";
import { finalizedParityFieldMap } from "../lib/calibration-library/finalize-calibration-extraction";
import type { ReportFieldKey } from "../lib/calibration-library/types";
import { runScriptWithTimeout } from "../lib/calibration-library/runtime-guard";
import { SCRIPT_DEFAULT_TIMEOUT_MS } from "../lib/calibration-library/runtime-limits";

const TARGET_REPORTS = new Set([
  "LG353466126",
  "LG360796191",
  "LG773657228",
  "2527039693",
]);

type ExtractionVariant = {
  variantId: string;
  fields: Record<ReportFieldKey, string>;
  parserType?: string;
  parserConfidence?: string;
  textMethod?: string;
  warnings?: string[];
  pipelineNotices?: string[];
  usedImageOcr?: boolean;
};

const PARITY_KEYS: readonly ReportFieldKey[] = [
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

async function resolveBestPdfPathForSpec(spec: AnchorPdfSpec): Promise<string | null> {
  return resolveAnchorPdfPath(spec);
}

function diffFields(
  a: ExtractionVariant,
  b: ExtractionVariant,
  keys: readonly ReportFieldKey[],
): Array<{ field: ReportFieldKey; a: string; b: string }> {
  const out: Array<{ field: ReportFieldKey; a: string; b: string }> = [];
  for (const k of keys) {
    const av = (a.fields[k] ?? "").trim();
    const bv = (b.fields[k] ?? "").trim();
    if (av === bv) continue;
    out.push({ field: k, a: av, b: bv });
  }
  return out;
}

function renderVariantSummary(v: ExtractionVariant): string {
  const bits = [
    `parser=${v.parserType ?? "—"}(${v.parserConfidence ?? "—"})`,
    `text=${v.textMethod ?? "—"}`,
    `imageOCR=${String(Boolean(v.usedImageOcr))}`,
  ];
  return bits.join(" · ");
}

function detectGenericScaleContamination(fields: Record<ReportFieldKey, string>): string[] {
  const bad: string[] = [];
  const finishKeys: ReportFieldKey[] = ["polish", "symmetry", "cutGrade"];
  for (const k of finishKeys) {
    const v = (fields[k] ?? "").trim();
    if (!v) continue;
    if (v === "Poor" || v === "Fair" || v === "Good") {
      bad.push(`${k}=${v}`);
    }
  }
  return bad;
}

function detectFluorescenceGarbage(fields: Record<ReportFieldKey, string>): string | null {
  const v = (fields.fluorescence ?? "").trim();
  if (!v) return null;
  const ok =
    /^(None|Faint|Medium|Strong|Very Strong)(?: (Blue|Yellow|White))?$/i.test(v);
  return ok ? null : `fluorescence="${v}"`;
}

function logFixtureOptimismCheck(
  reportNumber: string,
  fields: Record<ReportFieldKey, string>,
): void {
  const targets = ANCHOR_FIELD_TARGETS[reportNumber];
  if (!targets) return;

  const targetMisses: string[] = [];
  const mismatches: string[] = [];
  for (const [k, expected] of Object.entries(targets) as [ReportFieldKey, string][]) {
    const actual = (fields[k] ?? "").trim();
    if (!actual) {
      targetMisses.push(k);
      continue;
    }
    const ok =
      actual.toLowerCase() === expected.toLowerCase() ||
      actual.includes(expected) ||
      expected.includes(actual);
    if (!ok) {
      mismatches.push(`${k}: expected="${expected}" actual="${actual}"`);
    }
  }
  if (!targetMisses.length && !mismatches.length) return;
  console.log(`\n[INFO] fixture optimism check (non-fatal):`);
  if (targetMisses.length) console.log(`  missing: ${targetMisses.join(", ")}`);
  for (const m of mismatches) console.log(`  mismatch: ${m}`);
}

async function buildVariantsForPdf(input: {
  reportNumber: string;
  lab: string;
  pdfPath: string;
}): Promise<ExtractionVariant[]> {
  const bytes = readFileSync(input.pdfPath);

  const uploadReview = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    pipelineTimeoutMs: 120_000,
  });

  const anchorLive = await buildLiveAnchorExtractionAudit(
    {
      reportNumber: input.reportNumber,
      lab: input.lab as never,
      scenarioId: "parity",
      filenameHints: [],
    },
    input.pdfPath,
  );

  const restoreHints = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    lab: input.lab,
    reportNumber: input.reportNumber,
    reportSource: "pdf-upload",
    pipelineTimeoutMs: 120_000,
  });

  return [
    {
      variantId: "uploadReview",
      fields: finalizedParityFieldMap(uploadReview),
      parserType: uploadReview.parserType,
      parserConfidence: uploadReview.parserConfidence,
      textMethod: uploadReview.textMethod,
      warnings: uploadReview.warnings,
      pipelineNotices: uploadReview.pipelineNotices,
      usedImageOcr: uploadReview.ocrAttempted,
    },
    {
      variantId: "anchorLive",
      fields: Object.fromEntries(
        anchorLive.fields.map((r) => [r.field, r.value]),
      ) as Record<ReportFieldKey, string>,
      parserType: anchorLive.parserType,
      parserConfidence: anchorLive.parserConfidence,
      textMethod: anchorLive.textMethod,
      warnings: anchorLive.warnings,
      pipelineNotices: [],
      usedImageOcr: anchorLive.usedImageOcr,
    },
    {
      variantId: "restoreHints",
      fields: finalizedParityFieldMap(restoreHints),
      parserType: restoreHints.parserType,
      parserConfidence: restoreHints.parserConfidence,
      textMethod: restoreHints.textMethod,
      warnings: restoreHints.warnings,
      pipelineNotices: restoreHints.pipelineNotices,
      usedImageOcr: restoreHints.ocrAttempted,
    },
  ];
}

async function main() {
  const specs = ANCHOR_PDF_SPECS.filter((s) => TARGET_REPORTS.has(s.reportNumber));
  if (specs.length !== TARGET_REPORTS.size) {
    const missing = [...TARGET_REPORTS].filter(
      (id) => !specs.some((s) => s.reportNumber === id),
    );
    throw new Error(`Missing anchor spec(s): ${missing.join(", ")}`);
  }

  let hasFailures = false;

  for (const spec of specs) {
    const pdfPath = await resolveBestPdfPathForSpec(spec);
    if (!pdfPath) {
      console.error(`[${spec.reportNumber}] missing PDF on disk`);
      hasFailures = true;
      continue;
    }

    const variants = await buildVariantsForPdf({
      reportNumber: spec.reportNumber,
      lab: spec.lab,
      pdfPath,
    });

    const upload = variants.find((v) => v.variantId === "uploadReview")!;
    const anchor = variants.find((v) => v.variantId === "anchorLive")!;
    const restore = variants.find((v) => v.variantId === "restoreHints")!;

    console.log(`\n=== ${spec.lab} ${spec.reportNumber} ===`);
    console.log(`pdf=${pdfPath}`);
    for (const v of variants) {
      console.log(`- ${v.variantId}: ${renderVariantSummary(v)}`);
    }

    const uploadVsAnchor = diffFields(upload, anchor, PARITY_KEYS);
    if (uploadVsAnchor.length) {
      hasFailures = true;
      console.log(`\n[PARITY MISMATCH] uploadReview differs from anchorLive:`);
      for (const d of uploadVsAnchor) {
        console.log(
          `  ${d.field}: uploadReview="${d.a || "—"}" vs anchorLive="${d.b || "—"}"`,
        );
      }
    }

    const uploadVsRestore = diffFields(upload, restore, PARITY_KEYS);
    if (uploadVsRestore.length) {
      hasFailures = true;
      console.log(`\n[PARITY MISMATCH] uploadReview differs from restoreHints:`);
      for (const d of uploadVsRestore) {
        console.log(
          `  ${d.field}: uploadReview="${d.a || "—"}" vs restoreHints="${d.b || "—"}"`,
        );
      }
    }

    logFixtureOptimismCheck(spec.reportNumber, upload.fields);

    const contamination = detectGenericScaleContamination(upload.fields);
    if (contamination.length) {
      hasFailures = true;
      console.log(`\n[GENERIC SCALE CONTAMINATION] ${contamination.join(", ")}`);
    }

    const flGarbage = detectFluorescenceGarbage(upload.fields);
    if (flGarbage) {
      hasFailures = true;
      console.log(`\n[FLUORESCENCE GARBAGE ACCEPTED] ${flGarbage}`);
    }
  }

  if (hasFailures) {
    console.error("\nAudit failed: upload vs anchor parity violations detected.");
    process.exit(1);
  }

  console.log("\nAudit OK: upload vs anchor parity holds for target anchors.");
}

runScriptWithTimeout(
  main,
  Math.max(SCRIPT_DEFAULT_TIMEOUT_MS, 360_000),
  "audit-upload-vs-anchor-parity",
).catch((e) => {
  console.error(e);
  process.exit(1);
});
