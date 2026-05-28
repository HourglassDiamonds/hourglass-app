/**
 * Final cross-lab extraction baseline — fixture-driven, no live PDF/OCR.
 * Run: npx tsx scripts/final-extraction-baseline.ts
 */
import {
  formatBaselineSummary,
  runBaselineScenario,
  type BaselineScenario,
} from "../lib/calibration-library/extraction-baseline";
import { GCAL353466126_MARKETING_TRAP } from "../lib/calibration-library/fixtures/gcal353466126";
import { GCAL353466126_SCREENSHOT_OCR } from "../lib/calibration-library/fixtures/gcal353466126";
import { GCAL360796191_TEXT_LAYER } from "../lib/calibration-library/fixtures/gcal360796191";
import { GIA2527039693_PDF_TEXT_LAYER } from "../lib/calibration-library/fixtures/gia2527039693";
import {
  LG773657228_PDF_TEXT_ORDER,
  LG773657228_WITH_HEADER,
} from "../lib/calibration-library/fixtures/lg773657228";

const SCENARIOS: BaselineScenario[] = [
  {
    id: "gcal-8x-pdf-LG353466126",
    lab: "GCAL",
    reportNumber: "LG353466126",
    reportSource: "pdf-upload",
    textMethod: "pdf-text",
    text: GCAL353466126_MARKETING_TRAP,
  },
  {
    id: "gcal-sarine-pdf-LG360796191",
    lab: "GCAL",
    reportNumber: "LG360796191",
    reportSource: "pdf-upload",
    textMethod: "pdf-text",
    text: GCAL360796191_TEXT_LAYER,
  },
  {
    id: "gcal-screenshot-LG353466126",
    lab: "GCAL",
    reportNumber: "LG353466126",
    reportSource: "screenshot-upload",
    textMethod: "ocr",
    text: GCAL353466126_SCREENSHOT_OCR,
  },
  {
    id: "gia-pdf-2527039693",
    lab: "GIA",
    reportNumber: "2527039693",
    reportSource: "pdf-upload",
    textMethod: "pdf-text",
    text: GIA2527039693_PDF_TEXT_LAYER,
  },
  {
    id: "igi-pdf-LG773657228-proportions",
    lab: "IGI",
    reportNumber: "LG773657228",
    reportSource: "pdf-upload",
    textMethod: "pdf-text",
    text: LG773657228_PDF_TEXT_ORDER,
  },
  {
    id: "igi-pdf-LG773657228-header",
    lab: "IGI",
    reportNumber: "LG773657228",
    reportSource: "pdf-upload",
    textMethod: "pdf-text",
    text: LG773657228_WITH_HEADER,
  },
];

const results = SCENARIOS.map(runBaselineScenario);
console.log(formatBaselineSummary(results));

let failed = 0;
for (const r of results) {
  if (r.id === "gcal-8x-pdf-LG353466126" && r.parserPathUsed !== "gcal-8x") failed++;
  if (r.id === "gcal-sarine-pdf-LG360796191" && r.parserPathUsed !== "gcal-sarine-4cs") {
    failed++;
  }
  if (r.id === "gia-pdf-2527039693" && !r.recovered.some((x) => x.startsWith("shape="))) {
    failed++;
  }
  if (
    r.id === "igi-pdf-LG773657228-header" &&
    !r.recovered.some((x) => x.startsWith("polish="))
  ) {
    failed++;
  }
}

if (failed > 0) {
  console.error(`Baseline gate failures: ${failed}`);
  process.exit(1);
}

console.log("Baseline gates: OK");
