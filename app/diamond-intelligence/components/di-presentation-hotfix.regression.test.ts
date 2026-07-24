import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import {
  buildV3HeroPresentation,
  buildV3TraitLine,
  GCAL_8X_PERFORMANCE_VERIFIED_HEADLINE,
  isGcal8xCoherentHeroHeadline,
  resolveGcal8xPurchaseHeadline,
  V3_INCOMPLETE_ASSESSMENT_TRAIT_LINE,
} from "./v3-presentation";

const GIA_2548574094 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 2 - unknown GIA naturals/2548574094.pdf";
const GIA_2517213965 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 2 - unknown GIA naturals/2517213965.pdf";
const GCAL_360796247 =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 6 - GCAL 8x & GCAL unknown/360796247.pdf";

function scoredGiaFields() {
  const fields = emptyReportFields();
  fields.shape = "Round Brilliant";
  fields.carat = "1.50";
  fields.measurements = "7.40 - 7.44 x 4.50 mm";
  fields.tablePercent = "58";
  fields.depthPercent = "61.0";
  fields.crownAngle = "34.5";
  fields.pavilionAngle = "40.8";
  fields.girdle = "Medium to Slightly Thick";
  fields.culet = "None";
  fields.polish = "Excellent";
  fields.symmetry = "Excellent";
  fields.cutGrade = "Excellent";
  fields.fluorescence = "None";
  return fields;
}

describe("presentation hotfix — GCAL 8X precedence (A/B)", () => {
  const clarityPolicy = resolveHourglassClarityPolicy("VVS2");

  it("A/B: recognized GCAL 8X with null tier + low confidence is not Proportion Detail Needed", () => {
    const hero = buildV3HeroPresentation({
      purchaseRecommendation: "Worth Reviewing After Additional Information",
      publicTier: "Open",
      uncappedOpticalTier: "Open",
      displayScore: null,
      clarityPolicy,
      color: "D",
      clarity: "VVS2",
      canShowScore: false,
      lowInterpretationConfidence: true,
      opticalUnavailable: true,
      isGcal8x: true,
      gcal8xTier: null,
      confidenceBand: "Low",
    });
    assert.notEqual(hero.purchaseHeadline, "Proportion Detail Needed");
    assert.equal(hero.purchaseHeadline, GCAL_8X_PERFORMANCE_VERIFIED_HEADLINE);
    assert.notEqual(hero.purchaseHeadline, "Rare");
    assert.notEqual(hero.purchaseHeadline, "Exceptional");
    assert.equal(
      resolveGcal8xPurchaseHeadline(null),
      GCAL_8X_PERFORMANCE_VERIFIED_HEADLINE,
    );
  });

  it("C: GCAL 8X hero headline stays coherent with verified chrome", () => {
    const hero = buildV3HeroPresentation({
      purchaseRecommendation: "Worth Reviewing After Additional Information",
      publicTier: "Open",
      uncappedOpticalTier: "Open",
      displayScore: null,
      clarityPolicy,
      color: "D",
      clarity: "VVS2",
      canShowScore: false,
      lowInterpretationConfidence: true,
      opticalUnavailable: true,
      isGcal8x: true,
      gcal8xTier: null,
      confidenceBand: "Low",
    });
    assert.equal(isGcal8xCoherentHeroHeadline(hero.purchaseHeadline), true);
    assert.doesNotMatch(hero.purchaseHeadline, /proportion detail needed/i);
  });

  it("retains scored GCAL Rare/Exceptional when display score exists", () => {
    const rare = buildV3HeroPresentation({
      purchaseRecommendation: "Strong Candidate",
      publicTier: "Rare",
      uncappedOpticalTier: "Rare",
      displayScore: 98,
      clarityPolicy,
      color: "D",
      clarity: "VVS2",
      canShowScore: true,
      lowInterpretationConfidence: false,
      opticalUnavailable: false,
      isGcal8x: true,
      gcal8xTier: "Rare",
      confidenceBand: "High",
    });
    assert.equal(rare.purchaseHeadline, "Rare");
  });
});

describe("presentation hotfix — trait line (D/E/F)", () => {
  const strongContrastOnly = [
    {
      label: "Brightness" as const,
      level: "Needs review" as const,
      fillPercent: 0,
    },
    {
      label: "Fire" as const,
      level: "Needs review" as const,
      fillPercent: 0,
    },
    {
      label: "Scintillation" as const,
      level: "Needs review" as const,
      fillPercent: 0,
    },
    {
      label: "Contrast" as const,
      level: "Strong" as const,
      fillPercent: 100,
    },
    {
      label: "Leakage control" as const,
      level: "Needs review" as const,
      fillPercent: 0,
    },
  ];

  it("D: Strong Contrast does not produce Crisp · Crisp Contrast", () => {
    const line = buildV3TraitLine(strongContrastOnly, false, "VS2");
    assert.notEqual(line, "Crisp · Crisp Contrast");
    assert.equal(line, "Crisp");
  });

  it("E: incomplete GIA/IGI suppresses finish-only optical descriptors", () => {
    const line = buildV3TraitLine(strongContrastOnly, false, "VS2", {
      incompleteAssessment: true,
    });
    assert.equal(line, V3_INCOMPLETE_ASSESSMENT_TRAIT_LINE);
    assert.doesNotMatch(line, /crisp/i);
    assert.doesNotMatch(line, /bright/i);
  });

  it("F: fully scored GIA keeps Bright · Crisp · Strong Light Return", () => {
    const line = buildV3TraitLine(
      [
        { label: "Brightness", level: "Strong", fillPercent: 90 },
        { label: "Fire", level: "Balanced", fillPercent: 70 },
        { label: "Scintillation", level: "Strong", fillPercent: 90 },
        { label: "Contrast", level: "Strong", fillPercent: 100 },
        { label: "Leakage control", level: "Strong", fillPercent: 90 },
      ],
      false,
      "VS2",
    );
    assert.equal(line, "Bright · Crisp · Strong Light Return");
  });

  it("F: GCAL 8X keeps performance-verified trait line", () => {
    assert.equal(
      buildV3TraitLine([], true, "VVS2"),
      "Bright · Precise · Performance-Verified",
    );
  });

  it("F: scored GIA hero stays Strong Candidate when cores present", () => {
    const fields = scoredGiaFields();
    assert.equal(
      shouldPresentScoredCoreRead({
        fields,
        gradeHints: { color: "L", clarity: "VS2" },
      }),
      true,
    );
    const hero = buildV3HeroPresentation({
      purchaseRecommendation: "Strong Candidate",
      publicTier: "Exceptional",
      uncappedOpticalTier: "Exceptional",
      displayScore: 92,
      clarityPolicy: resolveHourglassClarityPolicy("VS2"),
      color: "L",
      clarity: "VS2",
      canShowScore: true,
      lowInterpretationConfidence: false,
      opticalUnavailable: false,
      isGcal8x: false,
      gcal8xTier: null,
      confidenceBand: "High",
    });
    assert.equal(hero.purchaseHeadline, "Strong Candidate");
  });
});

describe("presentation hotfix — GCAL stripped proportions still verified (G)", () => {
  it("stripping proportion fields still yields GCAL 8X PERFORMANCE VERIFIED", () => {
    const fields = emptyReportFields();
    fields.shape = "Round Brilliant";
    fields.carat = "1.04";
    fields.polish = "Excellent";
    fields.symmetry = "Excellent";
    const completeness = assessExtractionCompleteness({ fields });
    assert.equal(completeness.scoreEligible, false);

    const hero = buildV3HeroPresentation({
      purchaseRecommendation: "Worth Reviewing After Additional Information",
      publicTier: "Open",
      uncappedOpticalTier: "Open",
      displayScore: null,
      clarityPolicy: resolveHourglassClarityPolicy("VVS2"),
      color: "D",
      clarity: "VVS2",
      canShowScore: false,
      lowInterpretationConfidence: true,
      opticalUnavailable: true,
      isGcal8x: true,
      gcal8xTier: null,
      confidenceBand: "Low",
    });
    assert.equal(hero.purchaseHeadline, GCAL_8X_PERFORMANCE_VERIFIED_HEADLINE);
    assert.equal(
      buildV3TraitLine(
        [
          {
            label: "Contrast",
            level: "Strong",
            fillPercent: 100,
          },
        ],
        true,
        "VVS2",
        { incompleteAssessment: true },
      ),
      "Bright · Precise · Performance-Verified",
    );
  });
});

const livePdfDescribe = existsSync(GIA_2548574094) ? describe : describe.skip;

livePdfDescribe("presentation hotfix — live PDF fixtures (G)", () => {
  it(
    "GIA 2548574094 recovers four core proportions and is not Proportion Detail Needed",
    { timeout: 180_000 },
    async () => {
      const result = await interpretUploadedReport({
        bytes: readFileSync(GIA_2548574094),
        mime: "application/pdf",
        sourceFilename: "2548574094.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      const fields = result.interpretation.interpretationFields;
      assert.ok(fields.tablePercent?.trim());
      assert.ok(fields.depthPercent?.trim());
      assert.ok(fields.crownAngle?.trim());
      assert.ok(fields.pavilionAngle?.trim());
      assert.equal(
        shouldPresentScoredCoreRead({
          fields,
          gradeHints: result.interpretation.gradeHints,
        }),
        true,
      );
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
      assert.notEqual(hero.purchaseHeadline, "Proportion Detail Needed");
    },
  );

  it(
    "GIA 2517213965 recovers four core proportions and is not Proportion Detail Needed",
    { timeout: 180_000 },
    async () => {
      assert.equal(existsSync(GIA_2517213965), true);
      const result = await interpretUploadedReport({
        bytes: readFileSync(GIA_2517213965),
        mime: "application/pdf",
        sourceFilename: "2517213965.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      const fields = result.interpretation.interpretationFields;
      assert.ok(fields.tablePercent?.trim());
      assert.ok(fields.depthPercent?.trim());
      assert.ok(fields.crownAngle?.trim());
      assert.ok(fields.pavilionAngle?.trim());
      assert.equal(
        shouldPresentScoredCoreRead({
          fields,
          gradeHints: result.interpretation.gradeHints,
        }),
        true,
      );
    },
  );

  it(
    "GCAL LG360796247 remains GCAL 8X and performance-verified when proportions stripped in presentation",
    { timeout: 180_000 },
    async () => {
      assert.equal(existsSync(GCAL_360796247), true);
      const result = await interpretUploadedReport({
        bytes: readFileSync(GCAL_360796247),
        mime: "application/pdf",
        sourceFilename: "360796247.pdf",
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.interpretation.metadata.parserFamily, "gcal-8x");
      assert.equal(result.interpretation.metadata.reportFormat, "gcal-8x");

      const hero = buildV3HeroPresentation({
        purchaseRecommendation: "Worth Reviewing After Additional Information",
        publicTier: "Open",
        uncappedOpticalTier: "Open",
        displayScore: null,
        clarityPolicy: resolveHourglassClarityPolicy(
          result.interpretation.gradeHints?.clarity ?? "VVS2",
        ),
        color: result.interpretation.gradeHints?.color ?? "D",
        clarity: result.interpretation.gradeHints?.clarity ?? "VVS2",
        canShowScore: false,
        lowInterpretationConfidence: true,
        opticalUnavailable: true,
        isGcal8x: true,
        gcal8xTier: null,
        confidenceBand: "Low",
      });
      assert.equal(hero.purchaseHeadline, GCAL_8X_PERFORMANCE_VERIFIED_HEADLINE);
      assert.notEqual(hero.purchaseHeadline, "Proportion Detail Needed");
    },
  );
});
