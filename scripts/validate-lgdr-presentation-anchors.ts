/**
 * LGDR presentation anchor validation — mirrors LightPerformanceDashboard wiring.
 * Run: npx tsx --import ./scripts/set-client-doc-extract-timeout.mjs scripts/validate-lgdr-presentation-anchors.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { buildDiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";
import { buildClientDiamondDecisionProfile } from "@/lib/diamond-intelligence/client-decision-profile";
import {
  isPurchaseRecommendationEligibleForBroadPercentile,
  resolvePurchaseRecommendationLabel,
  type PurchaseRecommendationLabel,
} from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import { buildJustinPerspectiveParagraphs } from "@/lib/diamond-intelligence/v3-editorial-narrative";
import {
  buildV3PercentilePresentation,
  buildV3HeroPresentation,
  isGcal8xReport,
  resolveUncappedOpticalTier,
  resolveV3PublicTier,
  shouldShowHourglassPerspective,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { presentEditorialLightPerformance } from "@/lib/diamond-intelligence/client-editorial-language";
import { resolveNaturalGiaPresentationFlags } from "@/lib/diamond-intelligence/natural-gia-presentation-policy";
import { resolveLgdrPresentationFlags } from "@/lib/diamond-intelligence/lgdr-presentation-policy";
import type { OverallRecommendationBand } from "@/lib/diamond-intelligence/diamond-decision-profile";

const BATCH_DIR =
  "C:/Users/justi/OneDrive/Desktop/Test Batches/Test Batch 3 - unknown GIA LG";

const CHANGE_ANCHORS = [
  "7501664699",
  "6535655472",
  "2507821439",
  "3455448751",
] as const;

const CONTROL_ANCHORS = [
  "7538426153",
  "6502262027",
  "2504691249",
  "7496507350",
] as const;

type Snapshot = {
  reportId: string;
  lgdrActive: boolean;
  percentileCaution: boolean;
  treatmentDisclosure: boolean;
  purchaseLabel: PurchaseRecommendationLabel;
  broadPercentile: boolean;
  heroPercentile: string | null;
  gridPercentile: string | null;
  hourglassPerspective: boolean;
  justin: string;
  effectiveFinish: { cutGrade?: string; polish?: string; symmetry?: string };
};

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

async function snapshot(reportId: string): Promise<Snapshot> {
  const pdfPath = join(BATCH_DIR, `${reportId}.pdf`);
  const bytes = readFileSync(pdfPath);
  const result = await interpretUploadedReport({
    bytes,
    mime: "application/pdf",
    sourceFilename: `${reportId}.pdf`,
  });
  if (!result.ok) {
    fail(`${reportId}: interpret failed — ${result.error}`);
  }

  const { interpretation } = result;
  const fields = interpretation.interpretationFields;
  const metadata = interpretation.metadata;
  const capability = interpretation.capability;
  const gradeHints =
    interpretation.gradeHints ?? interpretation.decisionProfile?.gradeHints ?? {};

  const lgdrFlags = resolveLgdrPresentationFlags({
    metadata,
    reportTextHint: metadata.reportTextHint,
    fields,
  });
  const finish = lgdrFlags.active
    ? lgdrFlags.effectiveFinish
    : {
        cutGrade: fields.cutGrade,
        polish: fields.polish,
        symmetry: fields.symmetry,
      };

  const clientScore = presentClientInterpretationScore(
    fields,
    capability.interpretationLevel,
  );
  const rawScore = clientScore?.eligible ? clientScore.overall : null;
  const context = buildDiamondInterpretationContext({
    fields,
    rawScore,
    clarity: gradeHints.clarity,
  });
  const profile =
    interpretation.decisionProfile ??
    buildClientDiamondDecisionProfile({
      fields,
      metadata,
      capability,
      rawScore,
      gradeHints,
      reportTextHint: metadata.reportTextHint,
    });
  const clarityPolicy = resolveHourglassClarityPolicy(gradeHints.clarity);
  const editorial = presentEditorialLightPerformance({
    internalLabel: context.displayLabel,
    displayBand: context.displayBand,
    canShowScore: context.canShowScore,
    canShowRareLanguage: context.canShowRareLanguage,
  });
  const uncappedOpticalTier = resolveUncappedOpticalTier({
    editorialTier: editorial.tier,
    displayScore: context.displayScore,
    canShowScore: context.canShowScore,
  });
  const purchaseLabel = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band as OverallRecommendationBand,
    clarityPolicy,
    color: gradeHints.color,
    clarity: gradeHints.clarity,
    uncappedOpticalTierLabel:
      uncappedOpticalTier === "Open" ? "Needs Review" : uncappedOpticalTier,
    fluorescence: fields.fluorescence,
    cutGrade: finish.cutGrade,
    polish: finish.polish,
    symmetry: finish.symmetry,
  });
  const naturalFlags = resolveNaturalGiaPresentationFlags({
    metadata,
    reportTextHint: metadata.reportTextHint,
    fields,
    gradeHints,
    interpretationContext: context,
    purchaseLabel,
  });
  assert(!naturalFlags.active, `${reportId}: natural GIA gate must stay off for LGDR`);

  const justin = buildJustinPerspectiveParagraphs({
    clarityPolicy,
    isGcal8x: isGcal8xReport(metadata, fields),
    decisionProfile: profile,
    fields,
    metadata,
    reportTextHint: metadata.reportTextHint,
  }).join(" ");

  const percentile = buildV3PercentilePresentation(context.displayScore, {
    clarity: gradeHints.clarity,
    color: gradeHints.color,
    purchaseLabel,
    naturalGiaPercentileCaution: naturalFlags.percentileCaution,
    lgdrPercentileCaution: lgdrFlags.percentileCaution,
  });
  const hero = buildV3HeroPresentation({
    purchaseRecommendation: purchaseLabel,
    publicTier: resolveV3PublicTier({
      editorialTier: editorial.tier,
      displayScore: context.displayScore,
      canShowScore: context.canShowScore,
      clarity: gradeHints.clarity,
    }),
    uncappedOpticalTier,
    displayScore: context.displayScore,
    clarityPolicy,
    color: gradeHints.color,
    clarity: gradeHints.clarity,
    canShowScore: context.canShowScore,
    lowInterpretationConfidence: false,
    opticalUnavailable: profile.opticalPerformance.band === "Unavailable",
    isGcal8x: isGcal8xReport(metadata, fields) && !clarityPolicy.isExcluded,
    gcal8xTier: null,
    naturalGiaPercentileCaution: naturalFlags.percentileCaution,
    lgdrPercentileCaution: lgdrFlags.percentileCaution,
  });

  const broadPercentile = isPurchaseRecommendationEligibleForBroadPercentile({
    purchaseLabel,
    clarityPolicy,
    color: gradeHints.color,
  });

  return {
    reportId,
    lgdrActive: lgdrFlags.active,
    percentileCaution: lgdrFlags.percentileCaution,
    treatmentDisclosure: lgdrFlags.treatmentDisclosure,
    purchaseLabel,
    broadPercentile,
    heroPercentile: hero.percentile
      ? `${hero.percentile.topLine} — ${hero.percentile.topSubline}`
      : null,
    gridPercentile: percentile
      ? `${percentile.topLine} — ${percentile.topSubline} [${percentile.scope}]`
      : null,
    hourglassPerspective: shouldShowHourglassPerspective(fields, finish),
    justin,
    effectiveFinish: finish,
  };
}

function validateChangeAnchor(s: Snapshot): void {
  assert(s.lgdrActive, `${s.reportId}: LGDR context must be active`);

  if (s.reportId === "3455448751") {
    assert(s.treatmentDisclosure, `${s.reportId}: treatment disclosure required`);
    assert(/post-growth treatment/i.test(s.justin), `${s.reportId}: Justin must mention treatment`);
    assert(/treated color/i.test(s.justin), `${s.reportId}: Justin must mention treated color`);
    assert(s.percentileCaution, `${s.reportId}: percentile caution required`);
    return;
  }

  assert(
    s.purchaseLabel === "Worth Reviewing After Additional Information",
    `${s.reportId}: expected Worth Reviewing, got ${s.purchaseLabel}`,
  );
  assert(!s.broadPercentile, `${s.reportId}: broad percentile must be suppressed`);
  assert(s.heroPercentile === null, `${s.reportId}: hero broad Top X% must be absent`);
  assert(s.percentileCaution, `${s.reportId}: percentile caution required`);
  assert(
    s.gridPercentile !== null && !/^Top \d+%/.test(s.gridPercentile.split(" — ")[0] ?? ""),
    `${s.reportId}: grid percentile must be softened, got ${s.gridPercentile}`,
  );
  assert(s.hourglassPerspective, `${s.reportId}: Hourglass Perspective chapter required`);
  assert(/below Excellent/i.test(s.justin), `${s.reportId}: Justin finish caveat required`);
}

function validateControlAnchor(s: Snapshot): void {
  assert(s.lgdrActive, `${s.reportId}: LGDR context must be active`);
  assert(!s.percentileCaution, `${s.reportId}: percentile caution must stay off`);
  assert(!s.treatmentDisclosure, `${s.reportId}: no treatment disclosure`);
  assert(
    s.purchaseLabel === "Strong Candidate" || s.purchaseLabel === "Recommended",
    `${s.reportId}: expected strong purchase label, got ${s.purchaseLabel}`,
  );
  assert(s.broadPercentile, `${s.reportId}: broad percentile must remain eligible`);
  assert(s.heroPercentile !== null, `${s.reportId}: hero broad Top X% must show`);
  assert(/^Top \d+%/.test(s.heroPercentile ?? ""), `${s.reportId}: hero must show Top X%`);
  assert(!s.hourglassPerspective, `${s.reportId}: Hourglass Perspective must stay hidden`);
  assert(!/post-growth treatment/i.test(s.justin), `${s.reportId}: no treatment copy`);
  assert(!/below Excellent/i.test(s.justin), `${s.reportId}: no finish caveat`);
}

async function main(): Promise<void> {
  console.log("LGDR presentation anchor validation");
  console.log(`batch: ${BATCH_DIR}\n`);

  for (const id of CHANGE_ANCHORS) {
    const s = await snapshot(id);
    console.log(JSON.stringify(s, null, 2));
    validateChangeAnchor(s);
    console.log(`PASS change anchor ${id}\n`);
  }

  for (const id of CONTROL_ANCHORS) {
    const s = await snapshot(id);
    console.log(JSON.stringify(s, null, 2));
    validateControlAnchor(s);
    console.log(`PASS control anchor ${id}\n`);
  }

  console.log("ALL ANCHORS PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
