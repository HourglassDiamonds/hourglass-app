import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { buildV3PercentilePresentation } from "@/app/diamond-intelligence/components/v3-presentation";
import { buildJustinPerspectiveParagraphs } from "./v3-editorial-narrative";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { assessReportCapability } from "./report-capability";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import { resolvePurchaseRecommendationLabel } from "./purchase-recommendation-presentation";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";
import {
  buildNaturalGiaFluorescenceJustinParagraphs,
  isNaturalGiaPresentationContext,
  naturalGiaPercentileCautionActive,
  parseNaturalGiaFluorescencePresentation,
  resolveNaturalGiaFluorescenceForPresentation,
  resolveNaturalGiaPresentationFlags,
} from "./natural-gia-presentation-policy";

const NATURAL_GIA_METADATA = {
  lab: "GIA" as const,
  stoneType: "natural" as const,
  reportNumber: "TEST",
};

const LGDR_METADATA = {
  lab: "GIA" as const,
  stoneType: "lab-grown" as const,
  reportNumber: "2496027047",
};

const IGI_METADATA = {
  lab: "IGI" as const,
  stoneType: "natural" as const,
  reportNumber: "LG636401995",
};

function fieldsForAnchor(spec: {
  fluorescence: string;
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
}) {
  const fields = emptyReportFields();
  fields.shape = "Round Brilliant";
  fields.carat = "1.50";
  fields.measurements = "7.40 - 7.44 x 4.50 mm";
  fields.tablePercent = "58";
  fields.depthPercent = "61.0";
  fields.crownAngle = "34.5";
  fields.pavilionAngle = "40.8";
  fields.fluorescence = spec.fluorescence;
  fields.cutGrade = spec.cutGrade ?? "Excellent";
  fields.polish = spec.polish ?? "Excellent";
  fields.symmetry = spec.symmetry ?? "Excellent";
  return fields;
}

function presentationForAnchor(input: {
  reportId: string;
  color: string;
  clarity: string;
  fluorescence: string;
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
  rawScore?: number;
}) {
  const fields = fieldsForAnchor(input);
  const capability = assessReportCapability({
    fields,
    confidence: {},
    internalCalibrationEligible: true,
    excludedFromCalibrationStats: false,
  });
  const rawScore = input.rawScore ?? 99;
  const context = buildDiamondInterpretationContext({
    fields,
    rawScore,
    clarity: input.clarity,
  });
  const profile = buildClientDiamondDecisionProfile({
    fields,
    metadata: { ...NATURAL_GIA_METADATA, reportNumber: input.reportId },
    capability,
    rawScore,
    gradeHints: { color: input.color, clarity: input.clarity },
  });
  const clarityPolicy = resolveHourglassClarityPolicy(input.clarity);
  const purchaseLabel = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band,
    clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    uncappedOpticalTierLabel: "Rare",
    fluorescence: fields.fluorescence,
    cutGrade: fields.cutGrade,
    polish: fields.polish,
    symmetry: fields.symmetry,
  });
  const flags = resolveNaturalGiaPresentationFlags({
    metadata: { ...NATURAL_GIA_METADATA, reportNumber: input.reportId },
    fields,
    gradeHints: { color: input.color, clarity: input.clarity },
    interpretationContext: context,
    purchaseLabel,
  });
  const justin = buildJustinPerspectiveParagraphs({
    clarityPolicy,
    isGcal8x: false,
    decisionProfile: profile,
    fields,
    metadata: { ...NATURAL_GIA_METADATA, reportNumber: input.reportId },
  });
  const percentile = buildV3PercentilePresentation(context.displayScore, {
    clarity: input.clarity,
    color: input.color,
    purchaseLabel,
    naturalGiaPercentileCaution: flags.percentileCaution,
  });
  return {
    purchaseLabel,
    flags,
    justin,
    percentile,
    profile,
  };
}

describe("natural GIA presentation policy gate", () => {
  it("activates for natural GIA only", () => {
    assert.equal(
      isNaturalGiaPresentationContext(NATURAL_GIA_METADATA),
      true,
    );
    assert.equal(isNaturalGiaPresentationContext(LGDR_METADATA), false);
    assert.equal(
      isNaturalGiaPresentationContext(LGDR_METADATA, "GIA LGDR dossier"),
      false,
    );
    assert.equal(isNaturalGiaPresentationContext(IGI_METADATA), false);
  });

  it("parses green, strong blue, and medium blue fluorescence tiers", () => {
    assert.equal(
      parseNaturalGiaFluorescencePresentation("Medium Green").tier,
      "green-caution",
    );
    assert.equal(
      parseNaturalGiaFluorescencePresentation("Strong Blue").tier,
      "strong-blue",
    );
    assert.equal(
      parseNaturalGiaFluorescencePresentation("Medium Blue").tier,
      "medium-blue",
    );
    assert.equal(
      parseNaturalGiaFluorescencePresentation("None").tier,
      "none",
    );
  });

  it("recovers green hue from report text when extraction kept strength only", () => {
    assert.equal(
      resolveNaturalGiaFluorescenceForPresentation(
        "Medium",
        "GIA report fluorescence Medium Green on dossier",
      ),
      "Medium Green",
    );
    assert.equal(
      parseNaturalGiaFluorescencePresentation(
        resolveNaturalGiaFluorescenceForPresentation(
          "Medium",
          "fluorescence Medium Green",
        ),
      ).tier,
      "green-caution",
    );
  });
});

describe("Test Batch 2 natural GIA anchors — presentation only", () => {
  it("1489580465 — medium green gets Justin caution and soft percentile", () => {
    const result = presentationForAnchor({
      reportId: "1489580465",
      color: "I",
      clarity: "VS2",
      fluorescence: "Medium Green",
      rawScore: 99,
    });
    assert.equal(result.purchaseLabel, "Strong Candidate");
    assert.equal(result.flags.percentileCaution, true);
    assert.match(result.justin.join(" "), /green fluorescence/i);
    assert.doesNotMatch(result.justin.join(" "), /typically justify taking the next step/i);
    assert.ok(result.percentile);
    assert.doesNotMatch(result.percentile!.topLine, /^Top \d+%$/);
    assert.match(result.percentile!.topLine, /Strong optical profile/i);
  });

  it("1553146656 — strong blue disclosed and percentile softened", () => {
    const result = presentationForAnchor({
      reportId: "1553146656",
      color: "F",
      clarity: "VS2",
      fluorescence: "Strong Blue",
      rawScore: 93,
    });
    assert.equal(
      result.purchaseLabel,
      "Worth Reviewing After Additional Information",
    );
    assert.equal(result.flags.percentileCaution, true);
    assert.match(result.justin.join(" "), /strong blue fluorescence/i);
    assert.ok(result.percentile);
    assert.doesNotMatch(result.percentile!.topLine, /^Top \d+%$/);
  });

  it("2517213965 — medium blue noted in Justin's perspective", () => {
    const result = presentationForAnchor({
      reportId: "2517213965",
      color: "I",
      clarity: "VS2",
      fluorescence: "Medium Blue",
      rawScore: 96,
    });
    assert.match(result.justin.join(" "), /medium blue fluorescence/i);
    assert.equal(result.flags.percentileCaution, false);
    const percentile = buildV3PercentilePresentation(96, {
      clarity: "VS2",
      color: "I",
      purchaseLabel: result.purchaseLabel,
      naturalGiaPercentileCaution: false,
    });
    assert.match(percentile?.topLine ?? "", /^Top \d+%$/);
  });

  it("2517881873 — very good cut stays conservative with softened percentile", () => {
    const result = presentationForAnchor({
      reportId: "2517881873",
      color: "G",
      clarity: "SI1",
      fluorescence: "None",
      cutGrade: "Very Good",
      polish: "Excellent",
      symmetry: "Excellent",
      rawScore: 90,
    });
    assert.equal(
      result.purchaseLabel,
      "Worth Reviewing After Additional Information",
    );
    assert.equal(result.flags.percentileCaution, true);
    assert.ok(result.percentile);
    assert.doesNotMatch(result.percentile!.topLine, /^Top \d+%$/);
  });

  it("6505732277 — I1 remains outside standards with suppressed favorable percentile", () => {
    const result = presentationForAnchor({
      reportId: "6505732277",
      color: "F",
      clarity: "I1",
      fluorescence: "None",
      cutGrade: "Good",
      polish: "Good",
      symmetry: "Good",
      rawScore: 70,
    });
    assert.equal(result.purchaseLabel, "Outside Hourglass Standards");
    assert.equal(result.flags.percentileCaution, true);
    assert.equal(
      buildV3PercentilePresentation(70, {
        clarity: "I1",
        purchaseLabel: result.purchaseLabel,
        naturalGiaPercentileCaution: true,
      }),
      null,
    );
  });
});

describe("natural GIA fluorescence Justin copy", () => {
  it("returns approved disclosure tone for green fluorescence", () => {
    const paragraphs = buildNaturalGiaFluorescenceJustinParagraphs(
      parseNaturalGiaFluorescencePresentation("Medium Green"),
    );
    assert.ok(paragraphs);
    assert.match(paragraphs!.join(" "), /less commonly preferred than blue/i);
  });
});

describe("natural GIA percentile caution flags", () => {
  it("does not flag medium blue alone on triple excellent", () => {
    const fields = fieldsForAnchor({ fluorescence: "Medium Blue" });
    assert.equal(
      naturalGiaPercentileCautionActive({
        fields,
        gradeHints: { clarity: "VS2", color: "I" },
        interpretationContext: {
          extractionState: "FULL_EXTRACTION",
          readState: "full",
          confidenceLevel: "high",
        },
        purchaseLabel: "Strong Candidate",
      }),
      false,
    );
  });
});
