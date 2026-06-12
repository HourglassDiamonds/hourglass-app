import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import {
  IGI629451327_EXPECTED,
  IGI629451327_TEXT,
  IGI720512619_EXPECTED,
  IGI720512619_TEXT,
  IGI798614944_EXPECTED,
  IGI798614944_TEXT,
} from "@/lib/calibration-library/fixtures/igi-natural-electronic";
import {
  looksLikeGiaProportionStack,
  looksLikeGiaReportText,
} from "@/lib/calibration-library/gia-proportions";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import {
  clarityRecommendationCeiling,
  parseReportGradeHints,
} from "@/lib/diamond-intelligence/report-grade-hints";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";

const SPECS = [
  { id: "720512619", text: IGI720512619_TEXT, expected: IGI720512619_EXPECTED },
  { id: "798614944", text: IGI798614944_TEXT, expected: IGI798614944_EXPECTED },
  { id: "629451327", text: IGI629451327_TEXT, expected: IGI629451327_EXPECTED },
] as const;

describe("IGI natural Electronic Copy — routing guard", () => {
  it("explicit IGI header routes igi-standard even when GIA proportion stack matches", () => {
    const giaStackSnippet = "50%\n59%\n34.1°\n43.0%\n40.8°";
    assert.equal(looksLikeGiaProportionStack(giaStackSnippet), true);
    assert.equal(looksLikeGiaReportText(giaStackSnippet), true);

    const text = `
IGI
International Gemological Institute
IGI Report Number 720512619
${giaStackSnippet}
`;
    const family = detectReportFamily(text);
    assert.equal(family.parserType, "igi-standard");
    assert.equal(family.lab, "IGI");
  });

  for (const spec of SPECS) {
    it(`${spec.id} routes igi-standard (not gia-modern)`, () => {
      const family = detectReportFamily(spec.text, { lab: "IGI" });
      assert.equal(family.parserType, "igi-standard", spec.id);
      assert.equal(family.lab, "IGI", spec.id);
    });
  }
});

describe("IGI clarity spacing variants", () => {
  const variants = [
    { raw: "I 1", normalized: "I1" },
    { raw: "I1", normalized: "I1" },
    { raw: "I 2", normalized: "I2" },
    { raw: "I2", normalized: "I2" },
  ] as const;

  for (const variant of variants) {
    it(`normalizes clarity ${variant.raw} → ${variant.normalized}`, () => {
      const text = `
IGI
International Gemological Institute
GRADING RESULTS
Color Grade D
Clarity Grade ${variant.raw}
`;
      const hints = parseReportGradeHints(text);
      assert.equal(hints.clarity, variant.normalized);
      assert.equal(clarityRecommendationCeiling(hints.clarity), "Not Recommended");
    });
  }
});

describe("IGI natural Electronic Copy — text-layer extraction", () => {
  for (const spec of SPECS) {
    it(`${spec.id} extracts core proportions and finish from PDF text`, () => {
      const finalized = extractFieldsFromReportText(spec.text, {
        textMethod: "pdf-text",
        lab: "IGI",
        reportNumber: spec.id,
      });

      assert.equal(finalized.parserType, "igi-standard", spec.id);
      assert.equal(finalized.metadata.lab, "IGI", spec.id);
      assert.equal(finalized.fields.tablePercent, spec.expected.tablePercent, spec.id);
      assert.equal(finalized.fields.depthPercent, spec.expected.depthPercent, spec.id);
      assert.equal(finalized.fields.crownAngle, spec.expected.crownAngle, spec.id);
      assert.equal(
        finalized.fields.pavilionAngle,
        spec.expected.pavilionAngle,
        spec.id,
      );
      assert.equal(finalized.fields.cutGrade, spec.expected.cutGrade, spec.id);
      assert.equal(finalized.fields.polish, spec.expected.polish, spec.id);
      assert.equal(finalized.fields.symmetry, spec.expected.symmetry, spec.id);

      const hints = parseReportGradeHints(spec.text);
      assert.equal(hints.color, spec.expected.color, spec.id);
      assert.equal(hints.clarity, spec.expected.clarity, spec.id);

      const fluorescence =
        finalized.fields.fluorescence?.trim() ||
        hints.fluorescence?.trim() ||
        "";
      if (fluorescence) {
        assert.match(
          fluorescence,
          new RegExp(spec.expected.fluorescence.split(" ").join("|"), "i"),
          spec.id,
        );
      } else {
        assert.match(
          spec.text,
          new RegExp(spec.expected.fluorescence.split(" ").join("|"), "i"),
          `${spec.id} fluorescence present in source text`,
        );
      }
      const decision = classifyFinalized(finalized);
      assert.notEqual(decision.tier, "failure", spec.id);
      assert.equal(decision.tier, "full", spec.id);

      const completeness = assessExtractionCompleteness({
        fields: finalized.fields,
      });
      assert.equal(completeness.extractionState, "FULL_EXTRACTION", spec.id);
      assert.equal(completeness.scoreEligible, true, spec.id);

      const payload = toClientSafeInterpretationPayload(finalized);
      assert.equal(
        clarityRecommendationCeiling(payload.gradeHints?.clarity),
        spec.expected.recommendation,
        spec.id,
      );
    });
  }
});
