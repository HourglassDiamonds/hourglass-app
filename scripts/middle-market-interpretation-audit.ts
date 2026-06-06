/**
 * Middle-market interpretation audit — fixtures only, interpretation layer.
 * npx tsx scripts/middle-market-interpretation-audit.ts
 */
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { CalibrationReportFields, ReportFieldKey } from "@/lib/calibration-library/types";
import { buildClientDiamondDecisionProfile } from "@/lib/diamond-intelligence/client-decision-profile";
import { buildVisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import { assessReportCapability } from "@/lib/diamond-intelligence/report-capability";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";
import { buildDiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
import { buildDiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";

function empty(): CalibrationReportFields {
  return Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, ""])) as CalibrationReportFields;
}

type Case = {
  id: string;
  fields: Partial<Record<ReportFieldKey, string>>;
  hints: { clarity?: string; color?: string; fancyColor?: boolean };
  ext?: Partial<ReturnType<typeof buildDiamondInterpretationContext>>;
};

const CASES: Case[] = [
  {
    id: "GCAL-8X-strong",
    fields: {
      shape: "Round Brilliant",
      carat: "1.50",
      measurements: "7.40 - 7.42 x 4.58",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
      fluorescence: "None",
    },
    hints: { clarity: "VS1" },
  },
  {
    id: "GIA-excellent-balanced",
    fields: {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.53 x 4.01",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
      fluorescence: "None",
    },
    hints: { clarity: "VVS2" },
  },
  {
    id: "SI2-Excellent",
    fields: {
      shape: "Round",
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
    },
    hints: { clarity: "SI2" },
  },
  {
    id: "O-P-SI2-Excellent-Medium-fluo",
    fields: {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.52 x 4.00",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
      fluorescence: "Medium",
    },
    hints: { clarity: "SI2", color: "O" },
  },
  {
    id: "I1-Good",
    fields: {
      shape: "Round",
      carat: "1.00",
      measurements: "6.50 - 6.52 x 4.00",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
      polish: "Good",
      symmetry: "Good",
      cutGrade: "Good",
      fluorescence: "None",
    },
    hints: { clarity: "I1" },
  },
  {
    id: "I2-VG-700528875",
    fields: {
      shape: "Round Brilliant",
      carat: "1.00",
      measurements: "6.40 - 6.42 x 4.08",
      tablePercent: "55",
      depthPercent: "63.7",
      crownAngle: "36.1",
      pavilionAngle: "40.0",
      polish: "Very Good",
      symmetry: "Very Good",
      cutGrade: "Very Good",
      fluorescence: "None",
    },
    hints: { clarity: "I2", color: "G" },
  },
  {
    id: "Deep-Excellent",
    fields: {
      shape: "Round",
      carat: "1.00",
      measurements: "6.45 - 6.47 x 4.15",
      tablePercent: "55",
      depthPercent: "64.0",
      crownAngle: "36.0",
      pavilionAngle: "40.5",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
      fluorescence: "None",
    },
    hints: { clarity: "VS2" },
  },
  {
    id: "Spread-Excellent",
    fields: {
      shape: "Round",
      carat: "1.00",
      measurements: "6.55 - 6.57 x 3.95",
      tablePercent: "62",
      depthPercent: "59.0",
      crownAngle: "32.0",
      pavilionAngle: "40.0",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
      fluorescence: "None",
    },
    hints: { clarity: "VS1" },
  },
  {
    id: "Partial-extraction",
    fields: { shape: "Round", carat: "1.00", tablePercent: "57", depthPercent: "61.5" },
    hints: {},
    ext: {
      extractionState: "PARTIAL_EXTRACTION",
      readState: "partial",
      scoreEligible: false,
      canShowScore: false,
    },
  },
];

function runCase(c: Case) {
  const fields = { ...empty(), ...c.fields };
  const cap = assessReportCapability({ fields });
  const { internalCalibrationEligible: _i, ...clientCap } = cap;
  const cs = presentClientInterpretationScore(fields, cap.interpretationLevel);
  const raw = cs.eligible && cs.overall != null ? cs.overall : null;
  const ctx = { ...buildDiamondInterpretationContext({ fields, rawScore: raw }), ...c.ext };
  const profile = buildDiamondDecisionProfile({
    fields,
    metadata: { lab: "IGI", reportNumber: c.id, stoneType: "natural" },
    capability: clientCap,
    context: ctx,
    clientScore: cs,
    displayScore: ctx.displayScore,
    gradeHints: c.hints,
  });
  const personality = buildVisualPersonality({
    proportionArchetype: profile.archetype,
    opticalBand: profile.opticalPerformance.band,
    fields,
  });
  return { profile, personality, opticalScore: raw };
}

console.log("\nMIDDLE-MARKET INTERPRETATION AUDIT\n");
console.log(
  "Case".padEnd(28) +
    "Optical".padEnd(10) +
    "Conf".padEnd(8) +
    "Risk".padEnd(10) +
    "Rec".padEnd(36) +
    "Identity".padEnd(34) +
    "Visual",
);
console.log("-".repeat(130));

for (const c of CASES) {
  const { profile, personality } = runCase(c);
  const opticalDisplay =
    profile.confidence.band === "Low"
      ? profile.opticalPerformance.band === "Unavailable"
        ? "Limited Information Available"
        : "Preliminary Assessment"
      : `${profile.opticalPerformance.band}${profile.opticalPerformance.score != null ? `(${Math.round(profile.opticalPerformance.score)})` : ""}`;
  console.log(
    c.id.padEnd(28) +
      opticalDisplay.padEnd(10) +
      profile.confidence.band.padEnd(8) +
      profile.riskProfile.band.padEnd(10) +
      profile.overallRecommendation.band.padEnd(36) +
      profile.purchasePersonality.label.padEnd(34) +
      personality.displayTitle,
  );
}

console.log("\nDone.\n");
