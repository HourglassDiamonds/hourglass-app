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
  type OverallRecommendationBand,
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
import {
  DiamondIntelligenceIngestDock,
  type IngestMode,
} from "./DiamondIntelligenceIngestDock";
import type { ClientUploadPhase } from "./ReportUploadDock";
import type { ListingExtraction } from "@/lib/diamond-intelligence/url-ingestion/types";
import DiV3Hero from "./DiV3Hero";
import DiV3PartialGradeReview from "./DiV3PartialGradeReview";
import DiV3ResultSections from "./DiV3ResultSections";
import DiV3UnableToVerify from "./DiV3UnableToVerify";
import { resolveDiamondIntelligenceResultState } from "./diamond-intelligence-result-state";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { DI_EDITORIAL_CARD, DI_EYEBROW_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";
import { DI_V3_SHELL } from "./di-v3-styles";
import { resolveHourglassClarityPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
import type { DecisionConfidenceBand } from "@/lib/diamond-intelligence/decision-profile-confidence";
import {
  resolvePurchaseRecommendationLabel,
} from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import {
  buildV3HeroPresentation,
  buildV3TraitLine,
  isGcal8xReport,
  needsPartialGradeReview,
  shouldUseV3IncompleteChapterLayout,
  resolveGcal8xVisualTier,
  resolveUncappedOpticalTier,
  resolveV3PublicTier,
  resolveV3RenderPhase,
} from "./v3-presentation";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import {
  buildConciergeContextFromReport,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";

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
  ingestMode: IngestMode;
  onIngestModeChange: (mode: IngestMode) => void;
  fileName: string | null;
  uploadPhase: ClientUploadPhase;
  uploadError: string | null;
  uploadStatusNote?: string | null;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  onClearError?: () => void;
  partialListing?: ListingExtraction | null;
  partialListingMessage?: string | null;
  activeListing?: ListingExtraction | null;
  sourceUrl?: string | null;
  uploadFileName?: string | null;
  metadata: ClientSafeMetadata | null;
  extractedFields: CalibrationReportFields | null;
  interpretationFields: CalibrationReportFields | null;
  capability: ClientSafeReportCapability | null;
  gradeHints?: ReportGradeHints;
  onInterpretationUpdate: (snapshot: ClientInterpretationSnapshot) => void;
};

export default function LightPerformanceDashboard({
  ingestMode,
  onIngestModeChange,
  fileName,
  uploadPhase,
  uploadError,
  uploadStatusNote,
  onFile,
  onUrl,
  onClearError,
  partialListing,
  partialListingMessage,
  activeListing,
  sourceUrl,
  uploadFileName,
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

  const scoredCorePresentation = shouldPresentScoredCoreRead({
    fields,
    gradeHints,
  });
  const lowInterpretationConfidence =
    !scoredCorePresentation &&
    decisionProfile?.confidence.band === "Low";

  const clarityForPresentation =
    gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity;
  const colorForPresentation =
    gradeHints?.color ?? decisionProfile?.gradeHints.color;

  const uncappedOpticalTier = resolveUncappedOpticalTier({
    editorialTier: editorialPresentation.tier,
    displayScore: interpretationContext.displayScore,
    canShowScore: interpretationContext.canShowScore,
  });

  const purchaseRecommendation = decisionProfile
    ? resolvePurchaseRecommendationLabel({
        internalBand: decisionProfile.overallRecommendation
          .band as OverallRecommendationBand,
        clarityPolicy,
        color: colorForPresentation,
        clarity: clarityForPresentation,
        uncappedOpticalTierLabel:
          uncappedOpticalTier === "Open" ? "Needs Review" : uncappedOpticalTier,
        fluorescence: fields?.fluorescence,
        cutGrade: fields?.cutGrade,
        polish: fields?.polish,
        symmetry: fields?.symmetry,
      })
    : "Worth Reviewing After Additional Information";

  const conciergeVerdict =
    decisionProfile && fields
      ? purchaseRecommendation
      : partialListing
        ? "Listing found — report needed for full review"
        : null;

  const reportContext: DiamondIntelligenceConciergeContext = useMemo(
    () =>
      buildConciergeContextFromReport({
        metadata,
        fields: fields ?? undefined,
        gradeHints,
        ingestMode,
        sourceUrl: sourceUrl ?? (ingestMode === "url" ? fileName : null),
        activeListing: activeListing ?? partialListing ?? null,
        uploadFileName,
        verdict: conciergeVerdict,
      }),
    [
      metadata,
      fields,
      gradeHints,
      ingestMode,
      sourceUrl,
      fileName,
      activeListing,
      partialListing,
      uploadFileName,
      conciergeVerdict,
    ],
  );
  const heroPresentation = buildV3HeroPresentation({
    purchaseRecommendation,
    publicTier,
    uncappedOpticalTier,
    displayScore: interpretationContext.displayScore,
    clarityPolicy,
    color: colorForPresentation,
    clarity: clarityForPresentation,
    canShowScore: interpretationContext.canShowScore,
    lowInterpretationConfidence: Boolean(
      lowInterpretationConfidence && decisionProfile,
    ),
    opticalUnavailable:
      decisionProfile?.opticalPerformance.band === "Unavailable",
    isGcal8x: effectiveGcal8xPremium,
    gcal8xTier,
    confidenceBand: decisionProfile?.confidence
      .band as DecisionConfidenceBand | undefined,
  });

  const traitLine = buildV3TraitLine(
    clientScore?.lightTraits ?? [],
    effectiveGcal8xPremium,
    gradeHints?.clarity ?? decisionProfile?.gradeHints.clarity,
  );

  const resultState = resolveDiamondIntelligenceResultState({
    uploadPhase,
    uploadError: uploadError ?? null,
    hasReport,
    partialListing: Boolean(partialListing),
    v3RenderPhase,
    canRenderFullResult,
  });

  const busy = resultState === "PROCESSING";

  return (
    <section className={DI_V3_SHELL}>
      <div className={`${DI_EDITORIAL_CARD} mb-8 p-6 md:p-8`}>
        <p className={DI_EYEBROW_STUDIO}>Diamond Intelligence</p>
        <div className="mt-4">
          <DiamondIntelligenceIngestDock
            mode={ingestMode}
            onModeChange={onIngestModeChange}
            phase={uploadPhase}
            disabled={busy}
            errorMessage={uploadError}
            statusNote={uploadStatusNote}
            onFile={onFile}
            onUrl={onUrl}
            onClearError={onClearError}
            metadata={hasReport ? metadata : null}
            fileName={fileName}
            partialListing={partialListing}
            partialListingMessage={partialListingMessage}
          />
        </div>
      </div>

      {resultState === "PROCESSING" ? (
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

      {partialListing && resultState === "NO_RESULT" ? (
        <section className="relative py-6 md:py-8">
          <p className={DI_EYEBROW_STUDIO}>Listing Review</p>
          <p
            className={`${DI_SERIF_HEADLINE} mt-5 max-w-4xl text-4xl leading-[1.05] md:text-5xl xl:text-6xl`}
            style={{ textWrap: "balance" }}
          >
            {CONSUMER_COPY.partialListingHeadline}
          </p>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#75675e]">
            {CONSUMER_COPY.partialListingBody}
          </p>
        </section>
      ) : null}

      {resultState === "NO_RESULT" && !partialListing ? (
        <section className="relative py-6 md:py-8" aria-hidden>
          <div className="mx-auto h-px max-w-md bg-[linear-gradient(90deg,transparent,rgba(181,150,98,0.35),transparent)]" />
        </section>
      ) : null}

      {resultState === "ERROR" ? (
        <DiV3UnableToVerify
          onFile={onFile}
          reportContext={reportContext}
        />
      ) : null}

      {resultState === "PARTIAL" ? (
        <DiV3PartialGradeReview
          gradeHints={gradeHints}
          onComplete={(hints) => setLocalGradeHints(hints)}
        />
      ) : null}

      {resultState === "SUCCESS" &&
      decisionProfile &&
      interpretationSummary &&
      metadata &&
      fields ? (
        <div key={reportIdentity ?? "v3-result"}>
          {metadata.reportNumber ? (
            <p className="mx-auto mb-6 max-w-[960px] text-center text-[11px] uppercase tracking-[0.14em] text-[#9b8b78]">
              Current Report · {metadata.lab} {metadata.reportNumber}
            </p>
          ) : null}
          <DiV3Hero
            mode={effectiveGcal8xPremium ? "gcal8x" : "standard"}
            hero={heroPresentation}
            traitLine={traitLine}
            gcal8xTier={gcal8xTier ?? undefined}
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
            uncappedOpticalTier={uncappedOpticalTier}
            gcal8xTier={gcal8xTier}
            purchaseRecommendation={purchaseRecommendation}
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
            assessmentIncomplete={shouldUseV3IncompleteChapterLayout({
              lowInterpretationConfidence: Boolean(
                lowInterpretationConfidence && decisionProfile,
              ),
              hasDecisionProfile: Boolean(decisionProfile),
              clarityExcluded: clarityPolicy.isExcluded,
              purchaseRecommendation,
            })}
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

      {resultState === "SUCCESS" &&
      decisionProfile &&
      interpretationSummary &&
      metadata &&
      fields ? (
        <footer className="mx-auto mt-12 max-w-[960px] border-t border-[rgba(181,150,98,0.16)] py-7 text-[10px] leading-relaxed text-[#9b8b78]">
          <p>{CONSUMER_COPY.betaDisclosure}</p>
          <p className="mt-2">
            {CONSUMER_COPY.betaDisclosureOutreach}{" "}
            <a
              href="mailto:Justin@HourglassDiamonds.com"
              className="text-[#8b735b] underline decoration-[rgba(181,150,98,0.4)] underline-offset-[3px] transition-colors hover:text-[#5f5851]"
            >
              {CONSUMER_COPY.betaDisclosureEmail}
            </a>
            .
          </p>
          <p className="mt-2">
            Interpretation uses reported proportions and finish from your upload.
            Not laboratory grades.
          </p>
        </footer>
      ) : null}
    </section>
  );
}
