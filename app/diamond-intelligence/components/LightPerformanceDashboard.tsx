"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  buildBalanceProfileAxes,
  buildDiamondInterpretationContext,
  buildFaceUpPresenceCopy,
  buildOpticalInterpretationSummary,
  presentEditorialLightPerformance,
  buildClientDiamondDecisionProfile,
  presentClientInterpretationScore,
  spreadProfileValue,
  type ReportGradeHints,
  type ClientInterpretationSnapshot,
  type ClientSafeMetadata,
  type ClientSafeReportCapability,
  type OverallReadLabel,
} from "@/lib/diamond-intelligence";
import { buildVisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import { buildClarityReviewGuidance } from "@/lib/diamond-intelligence/clarity-review-guidance";
import { buildAdvisoryHighlights } from "./build-advisory-highlights";
import GuidedReportCompletion from "./GuidedReportCompletion";
import { ReportUploadDock, type ClientUploadPhase } from "./ReportUploadDock";
import DiV3Hero from "./DiV3Hero";
import DiV3PartialGradeReview from "./DiV3PartialGradeReview";
import DiV3ResultSections from "./DiV3ResultSections";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { DI_EDITORIAL_CARD, DI_EYEBROW_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";
import { DI_V3_SHELL } from "./di-v3-styles";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import {
  buildV3PercentilePresentation,
  buildV3TraitLine,
  isGcal8xReport,
  needsPartialGradeReview,
  resolveGcal8xVisualTier,
  resolveV3HeroVerdictLabel,
  resolveV3PublicTier,
  resolveV3RenderPhase,
} from "./v3-presentation";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

function formatCarat(carat: string): string {
  const v = carat.trim();
  if (!v) return "—";
  return v.includes("ct") ? v : `${v} ct`;
}

function parseAverageDiameterMm(measurements: string): string | null {
  const m = measurements.match(/(\d+\.?\d*)\s*[-–x×]\s*(\d+\.?\d*)/i);
  if (!m) return null;
  const a = parseFloat(m[1]!);
  const b = parseFloat(m[2]!);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return ((a + b) / 2).toFixed(2);
}

export type LightPerformanceDashboardProps = {
  fileName: string | null;
  uploadPhase: ClientUploadPhase;
  uploadError: string | null;
  uploadStatusNote?: string | null;
  onFile: (file: File) => void;
  onClearError?: () => void;
  metadata: ClientSafeMetadata | null;
  extractedFields: CalibrationReportFields | null;
  interpretationFields: CalibrationReportFields | null;
  capability: ClientSafeReportCapability | null;
  gradeHints?: ReportGradeHints;
  onInterpretationUpdate: (snapshot: ClientInterpretationSnapshot) => void;
};

export default function LightPerformanceDashboard({
  fileName,
  uploadPhase,
  uploadError,
  uploadStatusNote,
  onFile,
  onClearError,
  metadata,
  extractedFields,
  interpretationFields,
  capability,
  gradeHints: gradeHintsProp,
  onInterpretationUpdate,
}: LightPerformanceDashboardProps) {
  const [localGradeHints, setLocalGradeHints] = useState<
    ReportGradeHints | undefined
  >();

  const gradeHints = useMemo(() => {
    const fromServer = gradeHintsProp ?? {};
    const fromText =
      !fromServer.color || !fromServer.clarity
        ? metadata?.reportTextHint
          ? parseReportGradeHints(metadata.reportTextHint)
          : {}
        : {};
    return { ...fromText, ...fromServer, ...localGradeHints };
  }, [gradeHintsProp, localGradeHints, metadata?.reportTextHint]);

  const reportIdentity = metadata
    ? `${metadata.lab}:${metadata.reportNumber}`
    : null;

  useEffect(() => {
    setLocalGradeHints(undefined);
  }, [reportIdentity]);

  const hasReport = Boolean(
    metadata && extractedFields && interpretationFields && capability,
  );

  const fields = interpretationFields ?? extractedFields;

  const clientScore = useMemo(() => {
    if (!fields || !capability) return null;
    return presentClientInterpretationScore(
      fields,
      capability.interpretationLevel,
    );
  }, [fields, capability]);

  const rawOverallScore =
    clientScore?.eligible && clientScore.overall !== null
      ? clientScore.overall
      : null;

  const interpretationContext = useMemo(
    () =>
      buildDiamondInterpretationContext({
        fields,
        rawScore: rawOverallScore,
        clarity: gradeHints?.clarity,
      }),
    [fields, rawOverallScore, gradeHints?.clarity],
  );

  const overallScore = interpretationContext.displayScore;

  const diameter =
    fields?.measurements ? parseAverageDiameterMm(fields.measurements) : null;

  const diameterNum = diameter ? parseFloat(diameter) : null;

  const faceUpCopy = useMemo(() => {
    if (!fields) return null;
    return buildFaceUpPresenceCopy({
      measurements: fields.measurements ?? "",
      carat: fields.carat ?? "",
      avgDiameterMm: diameterNum,
    });
  }, [fields, diameterNum]);

  const interpretationSummary = useMemo(() => {
    if (!capability) return null;
    return buildOpticalInterpretationSummary({
      capability,
      clientScore,
      overallLabel: interpretationContext.displayLabel as OverallReadLabel,
      needsExpertDiagramReview: capability.needsExpertDiagramReview,
      copyTone: interpretationContext.copyTone,
    });
  }, [
    capability,
    clientScore,
    interpretationContext.displayLabel,
    interpretationContext.copyTone,
  ]);

  const profileAxes = useMemo(() => {
    const spread = spreadProfileValue({
      avgDiameterMm: diameterNum,
      carat: fields?.carat ?? "",
    });
    return buildBalanceProfileAxes({
      clientScore,
      overallScore,
      spread,
    });
  }, [clientScore, overallScore, diameterNum, fields?.carat]);

  const editorialPresentation = useMemo(
    () =>
      presentEditorialLightPerformance({
        internalLabel: interpretationContext.displayLabel,
        displayBand: interpretationContext.displayBand,
        canShowScore: interpretationContext.canShowScore,
        canShowRareLanguage: interpretationContext.canShowRareLanguage,
      }),
    [interpretationContext],
  );

  const decisionProfile = useMemo(() => {
    if (!fields || !capability || !metadata) return null;
    return buildClientDiamondDecisionProfile({
      fields,
      metadata,
      capability,
      rawScore: rawOverallScore,
      gradeHints: gradeHints ?? undefined,
    });
  }, [fields, capability, metadata, rawOverallScore, gradeHints]);

  const visualPersonality = useMemo(() => {
    if (!fields || !decisionProfile) return null;
    return buildVisualPersonality({
      proportionArchetype: decisionProfile.archetype,
      opticalBand: decisionProfile.opticalPerformance
        .band as import("@/lib/diamond-intelligence/diamond-decision-profile").OpticalPerformanceBand,
      fields,
    });
  }, [fields, decisionProfile]);

  const clarityReviewGuidance = useMemo(
    () =>
      decisionProfile
        ? buildClarityReviewGuidance(decisionProfile.gradeHints)
        : null,
    [decisionProfile],
  );

  const advisoryHighlights = useMemo(() => {
    if (!decisionProfile || !clientScore) {
      return { strengths: [] as string[], worthKnowing: [] as string[] };
    }
    return buildAdvisoryHighlights({
      lightTraits: clientScore.lightTraits,
      profileAxes,
      decisionProfile,
      purchasePersonality: decisionProfile.purchasePersonality,
      clarityReviewGuidance,
      faceUpCopy,
      fluorescence: fields?.fluorescence,
    });
  }, [
    decisionProfile,
    clientScore,
    profileAxes,
    clarityReviewGuidance,
    faceUpCopy,
    fields?.fluorescence,
  ]);

  const isGcal8x = isGcal8xReport(metadata, fields);
  const clarityPolicy = resolveHourglassClarityPolicy(
    gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
  );
  const effectiveGcal8x = isGcal8x && !clarityPolicy.isExcluded;
  const effectiveGcal8xPremium =
    effectiveGcal8x && !clarityPolicy.suppressPremiumTierLabels;
  const partialGradeReview = needsPartialGradeReview({
    gradeHints,
    canShowScore: interpretationContext.canShowScore,
  });

  const canRenderFullResult = Boolean(
    decisionProfile && interpretationSummary && metadata && fields,
  );

  const v3RenderPhase = resolveV3RenderPhase({
    hasReport,
    partialGradeReview,
    canRenderFullResult,
  });

  const publicTier = resolveV3PublicTier({
    editorialTier: editorialPresentation.tier,
    displayScore: interpretationContext.displayScore,
    canShowScore: interpretationContext.canShowScore,
    clarity: gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
  });

  const gcal8xTier = resolveGcal8xVisualTier(
    interpretationContext.displayScore,
    gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
  );

  const lowInterpretationConfidence =
    decisionProfile?.confidence.band === "Low";

  const heroVerdictLabel = resolveV3HeroVerdictLabel({
    clarity: gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
    lowInterpretationConfidence: Boolean(
      lowInterpretationConfidence && decisionProfile,
    ),
    opticalUnavailable:
      decisionProfile?.opticalPerformance.band === "Unavailable",
    isGcal8x: effectiveGcal8xPremium,
    gcal8xTier,
    publicTier,
  });

  const traitLine = buildV3TraitLine(
    clientScore?.lightTraits ?? [],
    effectiveGcal8xPremium,
    gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
  );

  const percentile =
    !effectiveGcal8xPremium &&
    !partialGradeReview &&
    !clarityPolicy.suppressFavorablePercentile &&
    interpretationContext.canShowScore
      ? buildV3PercentilePresentation(
          interpretationContext.displayScore,
          gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
        )
      : null;

  const reportContext =
    metadata && fields
      ? {
          lab: metadata.lab,
          reportNumber: metadata.reportNumber,
          carat: fields.carat,
          shape: fields.shape,
        }
      : {};

  const busy =
    uploadPhase === "reading" ||
    uploadPhase === "checking" ||
    uploadPhase === "building";

  return (
    <section className={DI_V3_SHELL}>
      <div className={`${DI_EDITORIAL_CARD} mb-8 p-6 md:p-8`}>
        <p className={DI_EYEBROW_STUDIO}>Report Upload</p>
        <div className="mt-4">
          <ReportUploadDock
            phase={uploadPhase}
            disabled={busy}
            errorMessage={uploadError}
            statusNote={uploadStatusNote}
            onFile={onFile}
            onClearError={onClearError}
            metadata={hasReport ? metadata : null}
            fileName={fileName}
          />
        </div>
      </div>

      {busy && !hasReport ? (
        <section className="relative py-4 md:py-6" aria-live="polite">
          <p className={DI_EYEBROW_STUDIO}>Diamond Intelligence</p>
          <p
            className={`${DI_SERIF_HEADLINE} mt-5 max-w-4xl text-4xl leading-[1.05] md:text-5xl xl:text-6xl`}
            style={{ textWrap: "balance" }}
          >
            {CONSUMER_COPY.processingStateHeadline}
          </p>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#75675e]">
            {CONSUMER_COPY.processingStateSupportingCopy}
          </p>
        </section>
      ) : null}

      {!hasReport && !busy && uploadPhase !== "error" ? (
        <section className="relative py-4 md:py-6">
          <p className={DI_EYEBROW_STUDIO}>Diamond Intelligence</p>
          <p
            className={`${DI_SERIF_HEADLINE} mt-5 max-w-4xl text-4xl leading-[1.05] md:text-5xl xl:text-6xl`}
            style={{ textWrap: "balance" }}
          >
            {CONSUMER_COPY.emptyStateIntro}
          </p>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#75675e]">
            {CONSUMER_COPY.emptyStateSupportingCopy}
          </p>
        </section>
      ) : null}

      {!hasReport && uploadPhase === "error" && uploadError ? (
        <section className="relative py-4 md:py-6" role="alert">
          <p className={DI_EYEBROW_STUDIO}>Upload issue</p>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#75675e]">
            {uploadError}
          </p>
        </section>
      ) : null}

      {v3RenderPhase === "partial" ? (
        <DiV3PartialGradeReview
          gradeHints={gradeHints}
          onComplete={(hints) => setLocalGradeHints(hints)}
        />
      ) : null}

      {hasReport &&
      v3RenderPhase === "full" &&
      !(decisionProfile && interpretationSummary && metadata && fields) ? (
        <section className="mx-auto max-w-[960px] py-6" role="status">
          <p className={DI_EYEBROW_STUDIO}>Interpretation</p>
          <p className="mt-4 max-w-xl text-lg leading-8 text-[#75675e]">
            {CONSUMER_COPY.interpretationUnavailableCopy}
          </p>
        </section>
      ) : null}

      {v3RenderPhase === "full" &&
      decisionProfile &&
      interpretationSummary &&
      metadata &&
      fields ? (
        <div key={reportIdentity ?? "v3-result"}>
          <DiV3Hero
            mode={effectiveGcal8xPremium ? "gcal8x" : "standard"}
            verdictLabel={heroVerdictLabel}
            traitLine={traitLine}
            percentile={percentile}
            gcal8xTier={gcal8xTier ?? undefined}
            clarityStandardsNote={null}
            reportContext={reportContext}
          />

          <DiV3ResultSections
            showPercentile={
              !effectiveGcal8xPremium &&
              !clarityPolicy.suppressFavorablePercentile &&
              interpretationContext.canShowScore
            }
            isGcal8x={effectiveGcal8xPremium}
            clarityPolicy={clarityPolicy}
            publicTier={publicTier}
            gcal8xTier={gcal8xTier}
            heroVerdictLabel={heroVerdictLabel}
            interpretationSummary={interpretationSummary}
            visualPersonality={visualPersonality}
            strengths={advisoryHighlights.strengths}
            worthKnowing={advisoryHighlights.worthKnowing}
            limitations={CONSUMER_COPY.reportCannotConfirmItems}
            decisionProfile={decisionProfile}
            interpretationContext={interpretationContext}
            fields={fields}
            diameter={diameter}
            formatCarat={formatCarat}
            reportContext={reportContext}
          />

          {capability &&
          extractedFields &&
          (capability.needsGuidedCompletion ||
            capability.needsExpertDiagramReview) ? (
            <div className="mx-auto mt-8 max-w-[960px]">
              <GuidedReportCompletion
                extractedFields={extractedFields}
                capability={capability}
                onInterpretationUpdate={onInterpretationUpdate}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {hasReport ? (
        <footer className="mx-auto mt-10 max-w-[960px] border-t border-[rgba(58,48,38,0.18)] py-6 text-[10px] leading-relaxed text-[#9b8b78]">
          Interpretation uses reported proportions and finish from your upload.
          Not laboratory grades.
        </footer>
      ) : null}
    </section>
  );
}
