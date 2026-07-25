/**
 * Production-parity regression: OCR_WORKER_URL set but remote unhealthy must
 * still recover core proportions via bundled local Tesseract (Vercel evidence:
 * health-http-404 left OCR unavailable and returned HTTP 200 with empty cores).
 *
 * PDFs stay outside the repo. Temporary forensic output is not written here.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import {
  getOcrRuntimeProbeSnapshot,
  setTesseractWorkerCreateOptions,
} from "@/lib/calibration-library/ocr";
import { CLIENT_OCR_RUNTIME_UNAVAILABLE_ERROR } from "@/lib/diamond-intelligence/client-interpret-messages";
import { clearClientInterpretCache } from "@/lib/diamond-intelligence/client-interpret-cache";
import {
  buildV3HeroPresentation,
  buildV3TraitLine,
  isGcal8xReport,
  resolveGcal8xVisualTier,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";

const GIA_2548574094 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 2 - unknown GIA naturals/2548574094.pdf";
const GIA_2517213965 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 2 - unknown GIA naturals/2517213965.pdf";
const GCAL_360796247 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 6 - GCAL 8x & GCAL unknown/360796247.pdf";

const originalFetch = globalThis.fetch;
const originalWorkerUrl = process.env.OCR_WORKER_URL;
const originalWorkerSecret = process.env.OCR_WORKER_SECRET;
const originalOcrDisabled = process.env.CALIBRATION_OCR_DISABLED;

function assertFourCores(fields: {
  tablePercent?: string;
  depthPercent?: string;
  crownAngle?: string;
  pavilionAngle?: string;
}) {
  assert.ok(fields.tablePercent?.trim(), "tablePercent");
  assert.ok(fields.depthPercent?.trim(), "depthPercent");
  assert.ok(fields.crownAngle?.trim(), "crownAngle");
  assert.ok(fields.pavilionAngle?.trim(), "pavilionAngle");
}

/** Compare measurement strings numerically when decimals are equivalent (33 vs 33.0). */
function assertMeasurementEqual(
  actual: string | undefined,
  expected: string,
  label: string,
) {
  const a = (actual ?? "").replace(/°/g, "").trim();
  const e = expected.trim();
  if (a === e) return;
  const an = Number(a);
  const en = Number(e);
  assert.ok(
    Number.isFinite(an) && Number.isFinite(en),
    `${label}: non-numeric actual=${JSON.stringify(a)} expected=${JSON.stringify(e)}`,
  );
  assert.equal(an, en, label);
}

function installBrokenRemoteOcr() {
  process.env.OCR_WORKER_URL = "http://ocr-worker.broken.test";
  process.env.OCR_WORKER_SECRET = "test-secret";
  delete process.env.CALIBRATION_OCR_DISABLED;
  setTesseractWorkerCreateOptions(null);
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/health") || url.includes("/recognize")) {
      return new Response("not found", { status: 404 });
    }
    return originalFetch(input as RequestInfo, init);
  };
}

function restoreOcrEnv() {
  globalThis.fetch = originalFetch;
  if (originalWorkerUrl === undefined) {
    delete process.env.OCR_WORKER_URL;
  } else {
    process.env.OCR_WORKER_URL = originalWorkerUrl;
  }
  if (originalWorkerSecret === undefined) {
    delete process.env.OCR_WORKER_SECRET;
  } else {
    process.env.OCR_WORKER_SECRET = originalWorkerSecret;
  }
  if (originalOcrDisabled === undefined) {
    delete process.env.CALIBRATION_OCR_DISABLED;
  } else {
    process.env.CALIBRATION_OCR_DISABLED = originalOcrDisabled;
  }
  setTesseractWorkerCreateOptions(null);
}

describe("production OCR remote-fallback parity", () => {
  before(() => {
    installBrokenRemoteOcr();
  });

  after(() => {
    restoreOcrEnv();
  });

  it(
    "GIA 2548574094 recovers four cores when remote OCR is 404",
    { timeout: 180_000 },
    async () => {
      assert.equal(existsSync(GIA_2548574094), true);
      const result = await interpretUploadedReport({
        bytes: readFileSync(GIA_2548574094),
        mime: "application/pdf",
        sourceFilename: "2548574094.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;

      const fields = result.interpretation.interpretationFields;
      assertFourCores(fields);
      assertMeasurementEqual(fields.tablePercent, "56", "tablePercent");
      assertMeasurementEqual(fields.depthPercent, "62.6", "depthPercent");
      assertMeasurementEqual(fields.crownAngle, "36.5", "crownAngle");
      assertMeasurementEqual(fields.pavilionAngle, "40.6", "pavilionAngle");

      const completeness = assessExtractionCompleteness({ fields });
      assert.equal(completeness.scoreEligible, true);
      assert.ok((result.finalized.timings?.imageOcrMs ?? 0) > 500);
      assert.equal(getOcrRuntimeProbeSnapshot().transport, "local");

      const hero = buildV3HeroPresentation({
        purchaseRecommendation: "Strong Candidate",
        publicTier: "Exceptional",
        uncappedOpticalTier: "Exceptional",
        displayScore: 90,
        clarityPolicy: resolveHourglassClarityPolicy(
          result.interpretation.gradeHints?.clarity,
        ),
        color: result.interpretation.gradeHints?.color,
        clarity: result.interpretation.gradeHints?.clarity,
        canShowScore: true,
        lowInterpretationConfidence: false,
        opticalUnavailable: false,
        isGcal8x: false,
        gcal8xTier: null,
        confidenceBand: "High",
      });
      assert.equal(hero.purchaseHeadline, "Strong Candidate");
      assert.notEqual(hero.purchaseHeadline, "Proportion Detail Needed");
    },
  );

  it(
    "GIA 2517213965 recovers four cores when remote OCR is 404",
    { timeout: 180_000 },
    async () => {
      assert.equal(existsSync(GIA_2517213965), true);
      setTesseractWorkerCreateOptions(null);
      installBrokenRemoteOcr();

      const result = await interpretUploadedReport({
        bytes: readFileSync(GIA_2517213965),
        mime: "application/pdf",
        sourceFilename: "2517213965.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;

      const fields = result.interpretation.interpretationFields;
      assertFourCores(fields);
      assertMeasurementEqual(fields.tablePercent, "59", "tablePercent");
      assertMeasurementEqual(fields.depthPercent, "59.1", "depthPercent");
      assertMeasurementEqual(fields.crownAngle, "33", "crownAngle");
      assertMeasurementEqual(fields.pavilionAngle, "40.8", "pavilionAngle");
      assert.ok((result.finalized.timings?.imageOcrMs ?? 0) > 500);
      assert.equal(getOcrRuntimeProbeSnapshot().transport, "local");

      const hero = buildV3HeroPresentation({
        purchaseRecommendation: "Strong Candidate",
        publicTier: "Exceptional",
        uncappedOpticalTier: "Exceptional",
        displayScore: 90,
        clarityPolicy: resolveHourglassClarityPolicy(
          result.interpretation.gradeHints?.clarity,
        ),
        color: result.interpretation.gradeHints?.color,
        clarity: result.interpretation.gradeHints?.clarity,
        canShowScore: true,
        lowInterpretationConfidence: false,
        opticalUnavailable: false,
        isGcal8x: false,
        gcal8xTier: null,
        confidenceBand: "High",
      });
      assert.equal(hero.purchaseHeadline, "Strong Candidate");
    },
  );

  it(
    "GCAL LG360796247 recovers four cores + Rare presentation when remote OCR is 404",
    { timeout: 180_000 },
    async () => {
      assert.equal(existsSync(GCAL_360796247), true);
      setTesseractWorkerCreateOptions(null);
      installBrokenRemoteOcr();

      const result = await interpretUploadedReport({
        bytes: readFileSync(GCAL_360796247),
        mime: "application/pdf",
        sourceFilename: "360796247.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;

      const fields = result.interpretation.interpretationFields;
      const metadata = result.interpretation.metadata;
      assertFourCores(fields);
      assertMeasurementEqual(fields.tablePercent, "57", "tablePercent");
      assertMeasurementEqual(fields.depthPercent, "61.6", "depthPercent");
      assertMeasurementEqual(fields.crownAngle, "34", "crownAngle");
      assertMeasurementEqual(fields.pavilionAngle, "40.8", "pavilionAngle");

      const sarine = result.finalized.gcalSarineOcrDiagnostics;
      if (sarine) {
        assert.equal(sarine.pageRendered, true);
        assert.ok((sarine.pageWidth ?? 0) > 0);
        assert.ok((sarine.pageHeight ?? 0) > 0);
        assert.equal(sarine.cropSucceeded, true);
        assert.ok((sarine.ocrRawLength ?? 0) > 0);
      }

      assert.equal(metadata.parserFamily, "gcal-8x");
      assert.ok((result.finalized.timings?.imageOcrMs ?? 0) > 500);
      assert.equal(getOcrRuntimeProbeSnapshot().transport, "local");

      const gradeHints = result.interpretation.gradeHints ?? {};
      const clarity = gradeHints.clarity ?? "VVS2";
      const clarityPolicy = resolveHourglassClarityPolicy(clarity);
      const clientScore = presentClientInterpretationScore(
        fields,
        result.interpretation.capability.interpretationLevel,
      );
      assert.equal(clientScore.eligible, true);
      assert.ok(clientScore.overall !== null && clientScore.overall >= 94);

      const gcal8x = isGcal8xReport(metadata, fields);
      assert.equal(gcal8x, true);
      const gcal8xTier = resolveGcal8xVisualTier(clientScore.overall, clarity);
      assert.equal(gcal8xTier, "Rare");

      const hero = buildV3HeroPresentation({
        purchaseRecommendation: "Strong Candidate",
        publicTier: "Rare",
        uncappedOpticalTier: "Rare",
        displayScore: clientScore.overall,
        clarityPolicy,
        color: gradeHints.color ?? "D",
        clarity,
        canShowScore: true,
        lowInterpretationConfidence: false,
        opticalUnavailable: false,
        isGcal8x: true,
        gcal8xTier,
        confidenceBand: "High",
      });
      const trait = buildV3TraitLine([], true, clarity);

      assert.equal(hero.purchaseHeadline, "Rare");
      assert.equal(trait, "Bright · Precise · Performance-Verified");
      assert.doesNotMatch(trait, /Crisp · Crisp/);
      assert.notEqual(hero.purchaseHeadline, "Proportion Detail Needed");
    },
  );

  it(
    "does not return silent HTTP 200 when diagram OCR runtime is fully unavailable",
    { timeout: 120_000 },
    async () => {
      assert.equal(existsSync(GIA_2548574094), true);
      clearClientInterpretCache();
      setTesseractWorkerCreateOptions(null);
      installBrokenRemoteOcr();
      process.env.CALIBRATION_OCR_DISABLED = "1";

      const result = await interpretUploadedReport({
        bytes: readFileSync(GIA_2548574094),
        mime: "application/pdf",
        sourceFilename: "2548574094.pdf",
      });

      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.httpStatus, 503);
      assert.equal(result.code, "ocr_runtime_unavailable");
      assert.equal(result.error, CLIENT_OCR_RUNTIME_UNAVAILABLE_ERROR);
      const fields = result.finalized?.fields;
      assert.equal(Boolean(fields?.tablePercent?.trim()), false);
    },
  );
});
