"use client";

import { useMemo } from "react";
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
import DiamondIntelligenceSynopsis from "./DiamondIntelligenceSynopsis";
import DiamondIntelligenceHero from "./DiamondIntelligenceHero";
import ReportMeasurementsSection from "./ReportMeasurementsSection";
import DiamondTechnicalProfileSection from "./DiamondTechnicalProfileSection";
import { CONSUMER_COPY } from "./consumer-display-labels";
import AdvisoryHighlightsSection from "./AdvisoryHighlightsSection";
import GoBeyondTheReportSection from "./GoBeyondTheReportSection";
import PerformanceReadSidebar from "./PerformanceReadSidebar";
import VisualPersonalitySection from "./VisualPersonalitySection";
import ReportStartingPointPanel from "./ReportStartingPointPanel";
import LookingDeeperPanel from "./LookingDeeperPanel";
import ComparingDiamondsPanel from "./ComparingDiamondsPanel";
import { buildVisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import { buildClarityReviewGuidance } from "@/lib/diamond-intelligence/clarity-review-guidance";
import { presentLowConfidenceGraphLabel } from "@/lib/diamond-intelligence/interpretation-display";
import { buildAdvisoryHighlights } from "./build-advisory-highlights";
import GuidedReportCompletion from "./GuidedReportCompletion";
import { ReportUploadDock, type ClientUploadPhase } from "./ReportUploadDock";
import { DashboardCard, MetricRow, dashValue } from "./DashboardCard";

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

function stoneTypeLabel(stoneType: string): string | null {
  if (stoneType === "natural") return "Natural";
  if (stoneType === "lab-grown") return "Lab-grown";
  return null;
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
  gradeHints,
  onInterpretationUpdate,
}: LightPerformanceDashboardProps) {
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

  // ── Single source of truth: every display decision comes from here. ──
  const interpretationContext = useMemo(
    () => buildDiamondInterpretationContext({ fields, rawScore: rawOverallScore }),
    [fields, rawOverallScore],
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
      opticalBand: decisionProfile.opticalPerformance.band as import("@/lib/diamond-intelligence/diamond-decision-profile").OpticalPerformanceBand,
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

  const lowInterpretationConfidence =
    decisionProfile?.confidence.band === "Low";
  const showPerformanceScore =
    interpretationContext.canShowScore &&
    !lowInterpretationConfidence &&
    overallScore !== null;

  const heroVerdictLabel =
    lowInterpretationConfidence && decisionProfile
      ? decisionProfile.opticalPerformance.band === "Unavailable"
        ? "Limited Information Available"
        : "Preliminary Assessment"
      : editorialPresentation.tierLabel;

  const centerProfileLabel = hasReport
    ? lowInterpretationConfidence && decisionProfile
      ? presentLowConfidenceGraphLabel(decisionProfile)
      : editorialPresentation.graphCenterLabel
    : "—";

  const busy =
    uploadPhase === "reading" ||
    uploadPhase === "checking" ||
    uploadPhase === "building";

  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-9 pt-5 md:px-6">
      <header className="mb-4">
        <p className="text-[11px] tracking-[0.2em] text-[#8a8177]">
          Light Performance
        </p>
        <h1 className="mt-1 font-serif text-2xl font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.65rem]">
          Diamond Intelligence
        </h1>
      </header>

      <DiamondIntelligenceSynopsis />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,292px)_1fr] xl:grid-cols-[minmax(0,308px)_1fr]">
        <aside className="flex flex-col gap-3.5 lg:max-w-[320px]">
          <DashboardCard title="Report" tone="subdued">
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
          </DashboardCard>

          <PerformanceReadSidebar
            hasReport={Boolean(hasReport && clientScore && capability)}
            showPerformanceScore={showPerformanceScore}
            overallScore={overallScore}
            tierLabel={heroVerdictLabel}
          />

          <DashboardCard title="Report details" tone="subdued">
            {hasReport && metadata && fields ? (
              <>
                <MetricRow label="Laboratory" value={metadata.lab} />
                <MetricRow
                  label="Report number"
                  value={dashValue(metadata.reportNumber)}
                />
                <MetricRow label="Shape" value={dashValue(fields.shape)} />
                <MetricRow
                  label="Carat weight"
                  value={formatCarat(fields.carat)}
                />
                <MetricRow
                  label="Measurements"
                  value={dashValue(fields.measurements)}
                />
                {stoneTypeLabel(metadata.stoneType) ? (
                  <MetricRow
                    label="Stone"
                    value={stoneTypeLabel(metadata.stoneType)!}
                  />
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[#948a80]">
                Report details appear after upload.
              </p>
            )}
          </DashboardCard>

          <ComparingDiamondsPanel visible={hasReport} />

          <LookingDeeperPanel visible={hasReport} />

          <ReportStartingPointPanel visible={hasReport} />
        </aside>

        <main className="min-w-0 space-y-3.5">
          {hasReport && decisionProfile && interpretationSummary ? (
            <DiamondIntelligenceHero
              verdictLabel={heroVerdictLabel}
              personalityDescriptor={editorialPresentation.personalityDescriptor}
              decisionProfile={decisionProfile}
              interpretationSummary={interpretationSummary}
            />
          ) : (
            <section className="overflow-hidden rounded-2xl border border-[#e4dbcf]/45 bg-[#faf8f5]/90 px-6 py-10 shadow-[0_6px_28px_rgba(48,36,28,0.04)] md:px-10 md:py-12">
              <p className="text-[11px] tracking-[0.18em] text-[#a8926a]">
                Our Verdict
              </p>
              <p className="mt-3 max-w-md font-serif text-[1.35rem] font-medium leading-[1.45] tracking-[-0.01em] text-[#3a352f] md:text-[1.45rem]">
                {CONSUMER_COPY.emptyStateIntro}
              </p>
              <p className="mt-3.5 max-w-sm text-[12.5px] leading-[1.7] text-[#8a8177]">
                Upload a GIA, IGI, or GCAL report and the advisory read builds
                alongside supporting evidence — no lab jargon, no scan gimmicks.
              </p>
              <div className="mt-5 flex items-center gap-2.5 text-[10px] tracking-[0.16em] text-[#b0a698]">
                <span className="h-px w-7 bg-[#d8cebf]" />
                <span>AWAITING REPORT</span>
              </div>
            </section>
          )}

          {hasReport ? (
            <VisualPersonalitySection personality={visualPersonality} />
          ) : null}

          {hasReport ? (
            <AdvisoryHighlightsSection
              strengths={advisoryHighlights.strengths}
              worthKnowing={advisoryHighlights.worthKnowing}
              radar={{
                axes: profileAxes,
                centerLabel: centerProfileLabel,
                canShowGraph: interpretationContext.canShowGraph,
                hasReport,
                graphMode: interpretationContext.graphMode,
                strengthMultiplier: interpretationContext.graphStrengthMultiplier,
              }}
            />
          ) : null}

          {hasReport ? (
            <GoBeyondTheReportSection
              visible={hasReport}
              reportContext={
                metadata && fields
                  ? {
                      lab: metadata.lab,
                      reportNumber: metadata.reportNumber,
                      carat: fields.carat,
                      shape: fields.shape,
                    }
                  : undefined
              }
            />
          ) : null}

          {hasReport &&
          capability &&
          extractedFields &&
          (capability.needsGuidedCompletion ||
            capability.needsExpertDiagramReview) ? (
            <GuidedReportCompletion
              extractedFields={extractedFields}
              capability={capability}
              onInterpretationUpdate={onInterpretationUpdate}
            />
          ) : null}

          {hasReport ? (
            <DiamondTechnicalProfileSection profile={decisionProfile} />
          ) : null}

          {hasReport ? (
            <ReportMeasurementsSection
              fields={fields}
              faceUpCopy={faceUpCopy}
              diameter={diameter}
              formatCarat={formatCarat}
            />
          ) : null}

          {!hasReport ? (
            <section className="rounded-lg border border-[#ebe4da]/45 bg-white/22 px-4 py-4 opacity-50 md:px-5 md:py-5">
              <p className="mb-3.5 text-[10px] tracking-[0.16em] text-[#c4bbb2]">
                {CONSUMER_COPY.technicalDecisionProfileTitle}
              </p>
              <p className="text-sm text-[#948a80]">
                Technical profile and report measurements appear after upload.
              </p>
            </section>
          ) : null}

          <footer className="border-t border-[#e4dbcf]/40 pt-2.5 text-[10px] leading-relaxed text-[#948a80]">
            Interpretation uses reported proportions and finish from your upload.
            Not laboratory grades.
          </footer>
        </main>
      </div>
    </div>
  );
}
