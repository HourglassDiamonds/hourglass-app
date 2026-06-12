import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { detectReportFamily } from "../lib/calibration-library/parsers/router";
import { extractFieldsFromReportText } from "../lib/calibration-library/extract-from-text";
import { parseReportGradeHints } from "../lib/diamond-intelligence/report-grade-hints";
import { needsPartialGradeReview } from "../app/diamond-intelligence/components/v3-presentation";
import { assessReportCapability } from "../lib/diamond-intelligence/report-capability";
import { presentClientInterpretationScore } from "../lib/diamond-intelligence/client-score-present";
import { GCAL_SARINE_LG340946327_OCR_TEXT } from "../lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import { GCAL_SARINE_LG340946323_OCR_TEXT } from "../lib/calibration-library/fixtures/gcal-sarine-lg340946323";
import {
  GCAL_SARINE_LG353456516_OCR_GARBLED_CLARITY,
} from "../lib/calibration-library/fixtures/gcal-sarine-lg353456516";
import { GCAL360196486_OCR_MULTILINE } from "../lib/calibration-library/fixtures/gcal360196486";
import { GCAL353466126_OCR_MULTILINE } from "../lib/calibration-library/fixtures/gcal353466126";
import { runCalibrationUploadExtraction } from "../lib/calibration-library/extract-upload-pipeline";

type Outcome = "Full" | "Partial" | "Failure";

type MatrixRow = {
  id: string;
  category: "fixture" | "live-jpg" | "variant";
  variant?: string;
  lab: string | null;
  reportNumber: string | null;
  parserFamily: string | null;
  routing: string | null;
  outcome: Outcome;
  color: string | null;
  clarity: string | null;
  canShowScore: boolean;
  partialGradeGate: boolean;
  missingFields: string[];
  notes?: string;
};

const FIXTURE_CASES = [
  {
    id: "LG340946327-fixture",
    text: GCAL_SARINE_LG340946327_OCR_TEXT,
    lab: "GCAL" as const,
  },
  {
    id: "LG340946323-fixture",
    text: GCAL_SARINE_LG340946323_OCR_TEXT,
    lab: "GCAL" as const,
  },
  {
    id: "LG353456516-garbled-clarity-fixture",
    text: GCAL_SARINE_LG353456516_OCR_GARBLED_CLARITY,
    lab: "GCAL" as const,
  },
  {
    id: "LG360196486-fixture",
    text: GCAL360196486_OCR_MULTILINE,
    lab: "GCAL" as const,
    reportNumber: "LG360196486",
  },
  {
    id: "LG353466126-fixture",
    text: GCAL353466126_OCR_MULTILINE,
    lab: "GCAL" as const,
    reportNumber: "LG353466126",
  },
] as const;

const LIVE_JPGS = [
  { id: "LG340946327-live-jpg", path: "C:/Users/justi/OneDrive/Desktop/GCAL340946327.jpg" },
  { id: "LG340946323-live-jpg", path: "C:/Users/justi/OneDrive/Desktop/GCAL340946323.jpg" },
  { id: "LG353456516-live-jpg", path: "C:/Users/justi/OneDrive/Desktop/GCAL353456516.jpg" },
  { id: "LG360196486-live-jpg", path: "C:/Users/justi/OneDrive/Desktop/GCAL360196486.jpg" },
] as const;

function classifyOutcome(input: {
  parserFamily: string | null;
  partialGradeGate: boolean;
  canShowScore: boolean;
  missingFields: string[];
}): Outcome {
  if (!input.parserFamily || input.parserFamily === "generic") return "Failure";
  if (input.partialGradeGate) return "Partial";
  if (!input.canShowScore && input.missingFields.length > 4) return "Partial";
  if (input.canShowScore || input.missingFields.length <= 4) return "Full";
  return "Partial";
}

function evaluateFixture(spec: (typeof FIXTURE_CASES)[number]): MatrixRow {
  const family = detectReportFamily(spec.text, { lab: spec.lab });
  const extracted = extractFieldsFromReportText(spec.text, {
    lab: spec.lab,
    textMethod: "ocr",
    reportNumber: "reportNumber" in spec ? spec.reportNumber : undefined,
  });
  const hints = parseReportGradeHints(spec.text);
  const cap = assessReportCapability({ fields: extracted.fields });
  const cs = presentClientInterpretationScore(
    extracted.fields,
    cap.interpretationLevel,
  );
  const canShowScore = Boolean(cs.eligible && cs.overall != null);
  const partialGradeGate = needsPartialGradeReview({
    gradeHints: hints,
    canShowScore,
  });
  const missingFields = Object.entries(extracted.fields)
    .filter(([, v]) => !v?.trim())
    .map(([k]) => k);

  return {
    id: spec.id,
    category: "fixture",
    lab: spec.lab,
    reportNumber: extracted.metadata.reportNumber ?? null,
    parserFamily: family.parserType,
    routing: family.parserType,
    outcome: classifyOutcome({
      parserFamily: family.parserType,
      partialGradeGate,
      canShowScore,
      missingFields,
    }),
    color: hints.color ?? null,
    clarity: hints.clarity ?? null,
    canShowScore,
    partialGradeGate,
    missingFields,
  };
}

async function evaluateLiveJpg(spec: (typeof LIVE_JPGS)[number]): Promise<MatrixRow> {
  const bytes = readFileSync(spec.path);
  const result = await runCalibrationUploadExtraction({
    bytes,
    mime: "image/jpeg",
    lab: "GCAL",
    mode: "calibration",
    pipelineTimeoutMs: 120_000,
  });
  const hints = parseReportGradeHints(result.reportGradeHintText ?? "");
  const cap = assessReportCapability({ fields: result.fields });
  const cs = presentClientInterpretationScore(
    result.fields,
    cap.interpretationLevel,
  );
  const canShowScore = Boolean(cs.eligible && cs.overall != null);
  const partialGradeGate = needsPartialGradeReview({
    gradeHints: hints,
    canShowScore,
  });
  const missingFields = Object.entries(result.fields)
    .filter(([, v]) => !v?.trim())
    .map(([k]) => k);

  return {
    id: spec.id,
    category: "live-jpg",
    variant: "jpg",
    lab: result.metadata?.lab ?? null,
    reportNumber: result.metadata?.reportNumber ?? null,
    parserFamily: result.parserType ?? null,
    routing: result.parserType ?? null,
    outcome: classifyOutcome({
      parserFamily: result.parserType ?? null,
      partialGradeGate,
      canShowScore,
      missingFields,
    }),
    color: hints.color ?? null,
    clarity: hints.clarity ?? null,
    canShowScore,
    partialGradeGate,
    missingFields,
    notes: result.timedOut ? "pipeline timeout" : undefined,
  };
}

async function main() {
  const rows: MatrixRow[] = FIXTURE_CASES.map(evaluateFixture);

  for (const spec of LIVE_JPGS) {
    if (!existsSync(spec.path)) continue;
    rows.push(await evaluateLiveJpg(spec));
  }

  const summary = {
    full: rows.filter((r) => r.outcome === "Full").length,
    partial: rows.filter((r) => r.outcome === "Partial").length,
    failure: rows.filter((r) => r.outcome === "Failure").length,
    total: rows.length,
  };

  const outDir = join(process.cwd(), "data/diamond-intelligence/beta-qa");
  mkdirSync(outDir, { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), summary, rows };
  writeFileSync(join(outDir, "outcome-matrix.json"), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
