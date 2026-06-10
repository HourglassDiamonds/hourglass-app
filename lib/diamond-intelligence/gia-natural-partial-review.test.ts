import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { toClientSafeInterpretationPayload } from "./client-api";
import { parseReportGradeHints, traceColorExtraction, traceClarityExtraction } from "./report-grade-hints";
import {
  buildV3TraitLine,
  needsPartialGradeReview,
  resolveV3PublicTier,
} from "../../app/diamond-intelligence/components/v3-presentation";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";

/** GIA natural facsimile — OCR appendix often carries 4Cs after the text-layer snippet. */
const GIA_6237893522_OCR_APPENDIX = `
GIA Report 6237893522
Shape and Cutting Style Round Brilliant
Carat Weight 1.05
Color Grade
O to P Range
Clarity Grade
SI2
Cut Grade Excellent
Polish Excellent
Symmetry Excellent
Fluorescence Medium Blue
Proportion Diagram
Table 57%
Total Depth 62.6%
Crown Angle 35.5°
Pavilion Angle 40.8°
Star Length 50%
Lower Half 80%
`;

const GIA_6482285473_OCR_APPENDIX = `
GIA Report 6482285473
Shape and Cutting Style Round Brilliant
Carat Weight 1.04
Color Grade F
Clarity Grade I1
Cut Grade Very Good
Polish Excellent
Symmetry Excellent
Fluorescence Medium Blue
Table 58%
Total Depth 63.0%
Crown Angle 34.0°
Pavilion Angle 41.8°
Star Length 45%
Lower Half 75%
`;

function giaNaturalFields(
  overrides: Partial<CalibrationReportFields> = {},
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return {
    ...base,
    shape: "Round Brilliant",
    carat: "1.05",
    measurements: "6.50 - 6.52 x 4.08",
    tablePercent: "57",
    depthPercent: "62.6",
    crownAngle: "35.5",
    pavilionAngle: "40.8",
    starLengthPercent: "50",
    lowerHalfPercent: "80",
    polish: "Excellent",
    symmetry: "Excellent",
    cutGrade: "Excellent",
    fluorescence: "Medium Blue",
    girdle: "Slightly Thick (Faceted)",
    culet: "None",
    ...overrides,
  };
}

describe("GIA natural facsimile grade hint parsing", () => {
  it("6237893522 parses O to P Range from GIA facsimile dot-leader text layer", () => {
    const dotLeaderText = `GIA Report Number   6237893522
Shape and Cutting Style   Round Brilliant
Carat Weight   1.05 carat
Color Grade   ........................................   O to P Range
Clarity Grade   ................................................................... SI2
Cut Grade   Excellent
Polish   Excellent
Symmetry   Excellent
Fluorescence   Medium Blue`;

    const hints = parseReportGradeHints(dotLeaderText);
    assert.equal(hints.clarity, "SI2");
    assert.equal(hints.color, "O to P Range");

    const trace = traceColorExtraction(dotLeaderText);
    assert.equal(trace.selected, "O to P Range");
    assert.ok(
      trace.candidates.some((c) => c.source === "color-dot-leader-range"),
    );
    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
      false,
    );
  });

  it("6237893522 parses O to P Range and SI2 from OCR appendix text", () => {
    const hints = parseReportGradeHints(GIA_6237893522_OCR_APPENDIX);
    assert.equal(hints.clarity, "SI2");
    assert.match(hints.color ?? "", /O to P Range/i);
  });

  it("6482285473 parses F and I1 from GIA facsimile dot-leader text layer", () => {
    const dotLeaderText = `GIA Report Number   6482285473
Shape and Cutting Style   Round Brilliant
Carat Weight   1.04 carat
Color Grade   ........................................   F
Clarity Grade   ................................................................... I1
Cut Grade   Very Good
Polish   Excellent
Symmetry   Excellent
Fluorescence   Medium Blue`;

    const hints = parseReportGradeHints(dotLeaderText);
    assert.equal(hints.color, "F");
    assert.equal(hints.clarity, "I1");

    const clarityTrace = traceClarityExtraction(dotLeaderText);
    assert.equal(clarityTrace.selected, "I1");
    assert.ok(
      clarityTrace.candidates.some((c) => c.source === "clarity-dot-leader"),
    );
    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
      false,
    );
  });

  it("6482285473 parses F and I1 from OCR appendix text", () => {
    const hints = parseReportGradeHints(GIA_6482285473_OCR_APPENDIX);
    assert.equal(hints.clarity, "I1");
    assert.equal(hints.color, "F");
  });

  it("6482285473 does not pick Y from cut-grade OCR noise (Very Good)", () => {
    const garbledOcr = `
GRADING RESULTS
LAY UIdUE cca Hl Profile to actus
UL Grade cece. VEry Good
0] 11] RTT = {of =] 1 (=1 1
Fluorescence Medium Blue
Inscription(s): GIA 6482285473
`;
    const hintsFromOcrOnly = parseReportGradeHints(garbledOcr);
    assert.notEqual(hintsFromOcrOnly.color, "Y");
    assert.equal(hintsFromOcrOnly.color, undefined);

    const combined = `${garbledOcr}\n${GIA_6482285473_OCR_APPENDIX}`;
    const hints = parseReportGradeHints(combined);
    assert.equal(hints.color, "F");
    assert.equal(hints.clarity, "I1");

    const trace = traceColorExtraction(combined);
    assert.equal(trace.selected, "F");
    assert.ok(
      trace.candidates.some(
        (c) => c.value === "F" && c.priority <= 2,
      ),
    );
    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: false }),
      false,
    );
  });
});

describe("GIA natural partial review gate", () => {
  it("6237893522 does not enter partial review when grades parse from combined hint", () => {
    const hints = parseReportGradeHints(GIA_6237893522_OCR_APPENDIX);
    assert.equal(
      needsPartialGradeReview({
        gradeHints: hints,
        canShowScore: false,
      }),
      false,
    );
  });

  it("6482285473 does not enter partial review when grades parse from combined hint", () => {
    const hints = parseReportGradeHints(GIA_6482285473_OCR_APPENDIX);
    assert.equal(
      needsPartialGradeReview({
        gradeHints: hints,
        canShowScore: false,
      }),
      false,
    );
  });

  it("6482285473 applies Outside Hourglass Standards policy for I1", () => {
    const policy = resolveHourglassClarityPolicy("I1");
    assert.equal(policy.isExcluded, true);
    assert.equal(policy.heroVerdictLabel, "Outside Hourglass Standards");
  });

  it("6237893522 SI2 caps premium tiers at Strong", () => {
    assert.equal(
      resolveV3PublicTier({
        editorialTier: "Distinctive",
        displayScore: 99,
        canShowScore: true,
        clarity: "SI2",
      }),
      "Strong",
    );
  });

  it("I1 hero trait line suppresses positive descriptors", () => {
    assert.equal(
      buildV3TraitLine(
        [
          {
            label: "Brightness",
            level: "Strong",
            fillPercent: 90,
          },
        ],
        false,
        "I1",
      ),
      "Clarity Concern · Visibility Risk · Not Recommended",
    );
  });
});

describe("client-api grade hint passthrough", () => {
  it("uses warnings OCR appendix for grade hints, not snippet alone", () => {
    const payload = toClientSafeInterpretationPayload(
      {
        metadata: {
          lab: "GIA",
          reportNumber: "6237893522",
          stoneType: "natural",
          reportSource: "upload",
        },
        fields: giaNaturalFields(),
        confidence: Object.fromEntries(
          REPORT_FIELD_KEYS.map((k) => [k, "high" as const]),
        ),
        rawTextSnippet: "GIA Report\nShape Round Brilliant\nCarat 1.05\n",
        warnings: [GIA_6237893522_OCR_APPENDIX],
        textMethod: "pdf-text",
      },
      undefined,
    );

    assert.equal(payload.gradeHints?.clarity, "SI2");
    assert.match(payload.gradeHints?.color ?? "", /O to P Range/i);
  });

  it("6237893522 uses reportGradeHintText beyond the 1200-char snippet", () => {
    const padding = "GIA Report header ".repeat(80);
    const payload = toClientSafeInterpretationPayload(
      {
        metadata: {
          lab: "GIA",
          reportNumber: "6237893522",
          stoneType: "natural",
          reportSource: "upload",
        },
        fields: giaNaturalFields(),
        confidence: Object.fromEntries(
          REPORT_FIELD_KEYS.map((k) => [k, "high" as const]),
        ),
        rawTextSnippet: padding.slice(0, 1200),
        reportGradeHintText: `${padding}\n${GIA_6237893522_OCR_APPENDIX}`,
        warnings: [],
        textMethod: "pdf-text",
      },
      undefined,
    );

    assert.equal(payload.gradeHints?.clarity, "SI2");
    assert.match(payload.gradeHints?.color ?? "", /O to P Range/i);
    assert.equal(
      needsPartialGradeReview({
        gradeHints: payload.gradeHints,
        canShowScore: false,
      }),
      false,
    );
  });

  it("normalizes O-P and O/P color range phrasing", () => {
    for (const appendix of [
      "Color Grade\nO-P Range\nClarity Grade\nSI2",
      "Color Grade\nO/P Range\nClarity Grade\nSI2",
    ]) {
      const hints = parseReportGradeHints(appendix);
      assert.equal(hints.clarity, "SI2");
      assert.match(hints.color ?? "", /O to P Range/i);
    }
  });

  it("6237893522 prefers full range over single-letter O on same line", () => {
    const hints = parseReportGradeHints(
      "Color Grade O to P Range\nClarity Grade SI2",
    );
    assert.equal(hints.color, "O to P Range");
    assert.equal(hints.clarity, "SI2");
  });

  it("single-letter color grades still parse (F, G, D)", () => {
    for (const [text, expected] of [
      ["Color Grade F\nClarity Grade VS1", "F"],
      ["Color Grade   ................   G\nClarity Grade SI1", "G"],
      ["Color Grade D", "D"],
    ] as const) {
      assert.equal(parseReportGradeHints(text).color, expected);
    }
  });
});
