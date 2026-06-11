import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { OpticalPerformanceBand } from "./diamond-decision-profile";
import { assessReportCapability } from "./report-capability";
import { presentClientInterpretationScore } from "./client-score-present";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";
import { HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE } from "./hourglass-clarity-policy";
import { buildVisualPersonality } from "./visual-personality";
import {
  buildJustinPerspectiveParagraphs,
  buildV3NoticePresentation,
  buildV3ReportSummaryParagraphs,
  displayV3PublicTierLabel,
} from "./v3-editorial-narrative";
import {
  buildV3HeroPresentation,
  resolveUncappedOpticalTier,
  resolveV3PublicTier,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentEditorialLightPerformance } from "./client-editorial-language";
import { resolvePurchaseRecommendationLabel } from "./purchase-recommendation-presentation";

function emptyFields(): CalibrationReportFields {
  return Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
}

function profileFixture(input: {
  clarity: string;
  color?: string;
  fields?: Partial<CalibrationReportFields>;
  metadata?: {
    lab: "GIA" | "GCAL" | "IGI";
    reportNumber: string;
    stoneType?: "natural" | "lab-grown";
  };
}) {
  const fields = {
    ...emptyFields(),
    shape: "Round Brilliant",
    carat: "1.00",
    measurements: "6.50 - 6.52 x 4.00",
    tablePercent: "57",
    depthPercent: "61.5",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
    polish: "Excellent",
    symmetry: "Excellent",
    cutGrade: "Excellent",
    fluorescence: "None",
    ...input.fields,
  };
  const cap = assessReportCapability({ fields });
  const { internalCalibrationEligible: _i, ...clientCap } = cap;
  const cs = presentClientInterpretationScore(fields, cap.interpretationLevel);
  const raw = cs.eligible && cs.overall != null ? cs.overall : null;
  const profile = buildClientDiamondDecisionProfile({
    fields,
    metadata: {
      lab: input.metadata?.lab ?? "GIA",
      reportNumber: input.metadata?.reportNumber ?? "TEST",
      stoneType: input.metadata?.stoneType ?? "natural",
    },
    capability: clientCap,
    rawScore: raw,
    gradeHints: { clarity: input.clarity, color: input.color },
  });
  return { profile, fields };
}

function combinedCopy(parts: string[]): string {
  return parts.join("\n");
}

describe("displayV3PublicTierLabel", () => {
  it("maps Open to Needs Review for consumers", () => {
    assert.equal(displayV3PublicTierLabel("Open"), "Needs Review");
    assert.equal(displayV3PublicTierLabel("Strong"), "Strong");
  });
});

describe("presentEditorialLightPerformance consumer labels", () => {
  it("shows Needs Review instead of Open on graph and tier label", () => {
    const pres = presentEditorialLightPerformance({
      internalLabel: "Report read",
      displayBand: null,
      canShowScore: false,
      canShowRareLanguage: false,
    });
    assert.equal(pres.tier, "Open");
    assert.equal(pres.tierLabel, "Needs Review");
    assert.equal(pres.graphCenterLabel, "Needs Review");
  });
});

describe("6237893522 SI2 editorial deduplication", () => {
  const clarityPolicy = resolveHourglassClarityPolicy("SI2");
  const { profile, fields } = profileFixture({
    clarity: "SI2",
    color: "O to P Range",
    fields: {
      cutGrade: "Very Good",
      tablePercent: "58",
      depthPercent: "62",
    },
    metadata: { lab: "GIA", reportNumber: "6237893522" },
  });
  const ctx = buildDiamondInterpretationContext({
    fields,
    rawScore: profile.opticalPerformance.score ?? null,
    clarity: "SI2",
  });
  const editorial = presentEditorialLightPerformance({
    internalLabel: ctx.displayLabel,
    displayBand: ctx.displayBand,
    canShowScore: ctx.canShowScore,
    canShowRareLanguage: ctx.canShowRareLanguage,
  });
  const publicTier = resolveV3PublicTier({
    editorialTier: editorial.tier,
    displayScore: ctx.displayScore,
    canShowScore: ctx.canShowScore,
    clarity: "SI2",
  });
  const uncappedOpticalTier = resolveUncappedOpticalTier({
    editorialTier: editorial.tier,
    displayScore: ctx.displayScore,
    canShowScore: ctx.canShowScore,
  });
  const purchase = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band,
    clarityPolicy,
    color: "O to P Range",
    clarity: "SI2",
    uncappedOpticalTierLabel:
      uncappedOpticalTier === "Open" ? "Needs Review" : uncappedOpticalTier,
  });
  const hero = buildV3HeroPresentation({
    purchaseRecommendation: purchase,
    publicTier,
    uncappedOpticalTier,
    displayScore: ctx.displayScore,
    clarityPolicy,
    color: "O to P Range",
    clarity: "SI2",
    canShowScore: ctx.canShowScore,
    lowInterpretationConfidence: true,
    opticalUnavailable: false,
    isGcal8x: false,
    gcal8xTier: null,
  });
  const visualPersonality = buildVisualPersonality({
    proportionArchetype: profile.archetype,
    opticalBand: profile.opticalPerformance.band,
    fields: fields,
  });

  it("hero reflects purchase recommendation not optical Exceptional", () => {
    assert.equal(hero.purchaseHeadline, "Justin Inspection Required");
    assert.notEqual(hero.purchaseHeadline, "Exceptional");
  });

  it("SI2 inspection copy appears once in Justin section only", () => {
    const summary = buildV3ReportSummaryParagraphs({
      clarityPolicy,
      isGcal8x: false,
      fields: fields,
      gradeHints: profile.gradeHints,
      purchaseRecommendation: purchase,
      uncappedOpticalTier,
      interpretationSummary: "Sample optical summary.",
    });
    const notice = buildV3NoticePresentation({
      clarityPolicy,
      isGcal8x: false,
      visualPersonality,
      purchaseRecommendation: purchase,
      opticalBand: profile.opticalPerformance.band,
    });
    const justin = buildJustinPerspectiveParagraphs({
      clarityPolicy,
      isGcal8x: false,
      decisionProfile: profile,
      fields: fields,
    });

    const allExceptJustin = combinedCopy([...summary, notice.lead, ...notice.body]);
    assert.doesNotMatch(allExceptJustin, /SI2 clarity requires direct review/i);
    assert.equal(
      (combinedCopy([...summary, notice.lead, ...notice.body, ...justin]).match(
        /SI2 clarity requires direct review/gi,
      ) ?? []).length,
      1,
    );
  });

  it("section 2 avoids More Information Needed and policy verdicts", () => {
    const notice = buildV3NoticePresentation({
      clarityPolicy,
      isGcal8x: false,
      visualPersonality,
      purchaseRecommendation: purchase,
      opticalBand: profile.opticalPerformance.band,
    });
    const block = `${notice.lead} ${notice.body.join(" ")}`;
    assert.doesNotMatch(block, /more information needed/i);
    assert.doesNotMatch(block, /preliminary assessment/i);
    assert.doesNotMatch(block, /not recommended/i);
  });
});

describe("6482285473 I1 editorial deduplication", () => {
  const clarityPolicy = resolveHourglassClarityPolicy("I1");
  const { profile, fields } = profileFixture({
    clarity: "I1",
    color: "F",
    metadata: { lab: "GIA", reportNumber: "6482285473" },
  });
  const purchase = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band,
    clarityPolicy,
    color: "F",
    clarity: "I1",
    uncappedOpticalTierLabel: "Strong",
  });

  it("hero is Outside Hourglass Standards", () => {
    assert.equal(purchase, "Outside Hourglass Standards");
  });

  it("sections focus on visual consequences without repeated exclusion copy", () => {
    const notice = buildV3NoticePresentation({
      clarityPolicy,
      isGcal8x: false,
      visualPersonality: null,
      purchaseRecommendation: purchase,
      opticalBand: profile.opticalPerformance.band,
    });
    const justin = buildJustinPerspectiveParagraphs({
      clarityPolicy,
      isGcal8x: false,
      decisionProfile: profile,
      fields: fields,
    });

    const body = combinedCopy([
      ...buildV3ReportSummaryParagraphs({
        clarityPolicy,
        isGcal8x: false,
        fields: fields,
        gradeHints: profile.gradeHints,
        purchaseRecommendation: purchase,
        uncappedOpticalTier: "Strong",
        interpretationSummary: "Optical summary.",
      }),
      notice.lead,
      ...notice.body,
      ...justin,
    ]);

    assert.doesNotMatch(notice.lead, /not recommended/i);
    assert.doesNotMatch(
      `${notice.lead} ${notice.body.join(" ")}`,
      /outside hourglass standards/i,
    );
    assert.doesNotMatch(
      `${notice.lead} ${notice.body.join(" ")} ${justin.join(" ")}`,
      new RegExp(HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE.slice(0, 40), "i"),
    );
    assert.match(body, /falls outside Hourglass standards/i);
  });
});

describe("6545889783 Fair Cut narrative", () => {
  const { profile, fields } = profileFixture({
    clarity: "VVS1",
    color: "F",
    fields: {
      cutGrade: "Fair",
      polish: "Excellent",
      symmetry: "Good",
      tablePercent: "54",
      depthPercent: "66.2",
      crownAngle: "40.0",
      pavilionAngle: "39.4",
    },
    metadata: { lab: "GIA", reportNumber: "6545889783" },
  });

  it("primary limiting factor is finish", () => {
    assert.equal(profile.primaryLimitingFactor.key, "finish");
  });

  it("Justin perspective references Fair cut, not generic confidence boilerplate", () => {
    const justin = buildJustinPerspectiveParagraphs({
      clarityPolicy: resolveHourglassClarityPolicy("VVS1"),
      isGcal8x: false,
      decisionProfile: profile,
      fields: fields,
    });
    const text = combinedCopy(justin);
    assert.match(text, /Fair cut grade/i);
    assert.doesNotMatch(text, /confirm optical imagery/i);
    assert.doesNotMatch(text, /optical structure before drawing stronger conclusions/i);
  });

  it("report summary mentions grades without duplicating hero verdict language", () => {
    const summary = buildV3ReportSummaryParagraphs({
      clarityPolicy: resolveHourglassClarityPolicy("VVS1"),
      isGcal8x: false,
      fields: fields,
      gradeHints: profile.gradeHints,
      purchaseRecommendation: "Strong Candidate",
      uncappedOpticalTier: "Balanced",
      interpretationSummary: "A balanced optical read from reported proportions.",
    });
    const text = combinedCopy(summary);
    assert.match(text, /F color/i);
    assert.match(text, /VVS1 clarity/i);
    assert.match(text, /Fair cut grade/i);
  });
});

describe("360796243 GCAL 8X narrative preserved", () => {
  const { profile, fields } = profileFixture({
    clarity: "VS1",
    color: "G",
    fields: {
      cutGrade: "Excellent",
      polish: "Excellent",
      symmetry: "Excellent",
    },
    metadata: { lab: "GCAL", reportNumber: "360796243" },
  });

  it("GCAL 8X report summary and Justin copy unchanged in structure", () => {
    const summary = buildV3ReportSummaryParagraphs({
      clarityPolicy: resolveHourglassClarityPolicy("VS1"),
      isGcal8x: true,
      fields: fields,
      gradeHints: profile.gradeHints,
      purchaseRecommendation: "Strong Candidate",
      uncappedOpticalTier: "Rare",
      interpretationSummary: "Strong optical read.",
    });
    assert.match(combinedCopy(summary), /GCAL 8X designation/);

    const justin = buildJustinPerspectiveParagraphs({
      clarityPolicy: resolveHourglassClarityPolicy("VS1"),
      isGcal8x: true,
      decisionProfile: profile,
      fields: fields,
    });
    assert.match(combinedCopy(justin), /GCAL 8X/);
    assert.match(combinedCopy(justin), /high-performance candidate/);
  });
});
