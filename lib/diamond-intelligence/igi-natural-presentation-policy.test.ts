import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { buildV3PercentilePresentation } from "@/app/diamond-intelligence/components/v3-presentation";
import { CONSUMER_COPY } from "@/app/diamond-intelligence/components/consumer-display-labels";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { assessReportCapability } from "./report-capability";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";
import { resolvePurchaseRecommendationLabel } from "./purchase-recommendation-presentation";
import { isLgdrPresentationContext } from "./lgdr-presentation-policy";
import { isNaturalGiaPresentationContext } from "./natural-gia-presentation-policy";
import { isGcal8xDisplayFramework } from "./gcal-8x-display";
import {
  hasIgiLabGrownPresentationMarkers,
  hasIgiNaturalDiamondEvidence,
  isIgiNaturalPresentationContext,
  resolveIgiNaturalPresentationFlags,
} from "./igi-natural-presentation-policy";

const IGI_NATURAL_METADATA = {
  lab: "IGI" as const,
  stoneType: "natural" as const,
  reportNumber: "720564220",
};

const IGI_LAB_GROWN_METADATA = {
  lab: "IGI" as const,
  stoneType: "lab-grown" as const,
  reportNumber: "LG636401995",
};

const GIA_NATURAL_METADATA = {
  lab: "GIA" as const,
  stoneType: "natural" as const,
  reportNumber: "2527039693",
};

const GCAL_METADATA = {
  lab: "GCAL" as const,
  stoneType: "natural" as const,
  reportNumber: "360196486",
};

const GCAL_8X_METADATA = {
  lab: "GCAL" as const,
  stoneType: "natural" as const,
  reportNumber: "360196486",
  reportFormat: "gcal-8x" as const,
};

const NATURAL_DIAMOND_HINT =
  "IGI Report Number 720564220 Description NATURAL DIAMOND";

function recommendationSnapshot(input: {
  metadata: {
    lab: "IGI" | "GIA" | "GCAL";
    stoneType: "natural" | "lab-grown";
    reportNumber: string;
    reportFormat?: "gcal-8x";
  };
  color: string;
  clarity: string;
  fluorescence: string;
  rawScore?: number;
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
  fields.fluorescence = input.fluorescence;
  fields.cutGrade = input.cutGrade ?? "Excellent";
  fields.polish = input.polish ?? "Excellent";
  fields.symmetry = input.symmetry ?? "Excellent";

  const capability = assessReportCapability({
    fields,
    confidence: {},
    internalCalibrationEligible: true,
    excludedFromCalibrationStats: false,
  });
  const rawScore = input.rawScore ?? 92;
  const context = buildDiamondInterpretationContext({
    fields,
    rawScore,
    clarity: input.clarity,
  });
  const profile = buildClientDiamondDecisionProfile({
    fields,
    metadata: input.metadata,
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
    uncappedOpticalTierLabel: "Exceptional",
    fluorescence: fields.fluorescence,
    cutGrade: fields.cutGrade,
    polish: fields.polish,
    symmetry: fields.symmetry,
  });
  const percentile = buildV3PercentilePresentation(context.displayScore, {
    clarity: input.clarity,
    color: input.color,
    purchaseLabel,
  });

  return {
    purchaseLabel,
    displayScore: context.displayScore,
    percentileTopLine: percentile?.topLine ?? null,
    internalBand: profile.overallRecommendation.band,
  };
}

describe("IGI natural presentation policy gate", () => {
  it("activates for IGI + natural stone type", () => {
    assert.equal(
      isIgiNaturalPresentationContext(IGI_NATURAL_METADATA),
      true,
    );
    assert.equal(
      resolveIgiNaturalPresentationFlags({
        metadata: IGI_NATURAL_METADATA,
      }).active,
      true,
    );
  });

  it("activates for IGI + NATURAL DIAMOND hint when stone type is unknown", () => {
    assert.equal(
      isIgiNaturalPresentationContext(
        { lab: "IGI", stoneType: "unknown" },
        NATURAL_DIAMOND_HINT,
      ),
      true,
    );
  });

  it("does not activate for unknown stone type without NATURAL DIAMOND evidence", () => {
    assert.equal(
      isIgiNaturalPresentationContext(
        { lab: "IGI", stoneType: "unknown" },
        "IGI Report Number 720564220",
      ),
      false,
    );
    assert.equal(hasIgiNaturalDiamondEvidence({ stoneType: "unknown" }), false);
  });

  it("does not activate for IGI lab-grown", () => {
    assert.equal(
      isIgiNaturalPresentationContext(IGI_LAB_GROWN_METADATA),
      false,
    );
  });

  it("does not activate for laboratory-grown, CVD, or HPHT hint markers", () => {
    assert.equal(
      hasIgiLabGrownPresentationMarkers("LABORATORY-GROWN DIAMOND REPORT"),
      true,
    );
    assert.equal(hasIgiLabGrownPresentationMarkers("Growth method CVD"), true);
    assert.equal(hasIgiLabGrownPresentationMarkers("HPHT grown"), true);
    assert.equal(
      isIgiNaturalPresentationContext(
        { lab: "IGI", stoneType: "unknown" },
        "Description NATURAL DIAMOND laboratory-grown",
      ),
      false,
    );
  });

  it("does not activate for GIA natural or LGDR", () => {
    assert.equal(isIgiNaturalPresentationContext(GIA_NATURAL_METADATA), false);
    assert.equal(
      isNaturalGiaPresentationContext(GIA_NATURAL_METADATA),
      true,
    );
    assert.equal(
      isLgdrPresentationContext(
        { lab: "GIA", stoneType: "lab-grown" },
        "LGDR dossier",
      ),
      true,
    );
    assert.equal(
      isIgiNaturalPresentationContext(
        { lab: "GIA", stoneType: "lab-grown" },
        "LGDR dossier",
      ),
      false,
    );
  });

  it("does not activate for GCAL or GCAL 8X", () => {
    assert.equal(isIgiNaturalPresentationContext(GCAL_METADATA), false);
    assert.equal(isIgiNaturalPresentationContext(GCAL_8X_METADATA), false);
    assert.equal(
      isGcal8xDisplayFramework({
        lab: "GCAL",
        reportFormat: "gcal-8x",
      }),
      true,
    );
  });
});

describe("IGI natural lab-context disclosure copy", () => {
  it("exists with approved educational tone", () => {
    assert.equal(CONSUMER_COPY.igiNaturalLabContextTitle, "About This Laboratory");
    assert.ok(CONSUMER_COPY.igiNaturalLabContextParagraphs.length >= 2);
    const joined = CONSUMER_COPY.igiNaturalLabContextParagraphs.join(" ");
    assert.match(joined, /widely recognized/i);
    assert.match(joined, /does not mean an individual grade is incorrect/i);
  });

  it("does not mention automatic penalty or rejection", () => {
    const joined = CONSUMER_COPY.igiNaturalLabContextParagraphs.join(" ").toLowerCase();
    assert.doesNotMatch(joined, /automatically reject/);
    assert.doesNotMatch(joined, /not recommended/);
    assert.doesNotMatch(joined, /penalt/);
    assert.doesNotMatch(joined, /outside hourglass/);
  });
});

describe("IGI natural anchors — presentation gate only, outcomes unchanged", () => {
  const anchors = [
    {
      reportId: "720564220",
      color: "F",
      clarity: "VS2",
      fluorescence: "None",
      rawScore: 96,
      expectedPurchase: "Strong Candidate",
    },
    {
      reportId: "741569320",
      color: "I",
      clarity: "SI2",
      fluorescence: "Strong",
      rawScore: 68,
      cutGrade: "Good",
      polish: "Very Good",
      symmetry: "Very Good",
      expectedPurchase: "Not Recommended",
    },
    {
      reportId: "747534888",
      color: "I",
      clarity: "VS1",
      fluorescence: "Strong",
      rawScore: 88,
      expectedPurchase: "Worth Reviewing After Additional Information",
    },
    {
      reportId: "752513726",
      color: "H",
      clarity: "SI1",
      fluorescence: "Strong",
      rawScore: 92,
      expectedPurchase: "Worth Reviewing After Additional Information",
    },
    {
      reportId: "766640159",
      color: "F",
      clarity: "I1",
      fluorescence: "Very Slight",
      rawScore: 72,
      cutGrade: "Very Good",
      polish: "Very Good",
      symmetry: "Very Good",
      expectedPurchase: "Outside Hourglass Standards",
    },
    {
      reportId: "774608096",
      color: "H",
      clarity: "VS1",
      fluorescence: "Strong",
      rawScore: 93,
      expectedPurchase: "Worth Reviewing After Additional Information",
    },
    {
      reportId: "788631951",
      color: "F",
      clarity: "VS1",
      fluorescence: "Slight",
      rawScore: 92,
      expectedPurchase: "Strong Candidate",
    },
  ] as const;

  for (const anchor of anchors) {
    it(`${anchor.reportId} — gate active; recommendation label stable`, () => {
      const flags = resolveIgiNaturalPresentationFlags({
        metadata: {
          ...IGI_NATURAL_METADATA,
          reportNumber: anchor.reportId,
        },
        reportTextHint: NATURAL_DIAMOND_HINT,
      });
      assert.equal(flags.active, true);

      const before = recommendationSnapshot({
        metadata: {
          ...IGI_NATURAL_METADATA,
          reportNumber: anchor.reportId,
        },
        color: anchor.color,
        clarity: anchor.clarity,
        fluorescence: anchor.fluorescence,
        rawScore: anchor.rawScore,
        cutGrade: "cutGrade" in anchor ? anchor.cutGrade : undefined,
        polish: "polish" in anchor ? anchor.polish : undefined,
        symmetry: "symmetry" in anchor ? anchor.symmetry : undefined,
      });

      assert.equal(before.purchaseLabel, anchor.expectedPurchase);

      const percentileWithGate = buildV3PercentilePresentation(
        before.displayScore,
        {
          clarity: anchor.clarity,
          color: anchor.color,
          purchaseLabel: before.purchaseLabel,
        },
      );
      assert.equal(
        percentileWithGate?.topLine ?? null,
        before.percentileTopLine,
      );
    });
  }
});
