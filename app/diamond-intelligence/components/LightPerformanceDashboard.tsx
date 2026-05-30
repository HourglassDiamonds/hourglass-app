"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  CLIENT_FIELD_LABELS,
  buildBalanceProfileAxes,
  buildDiamondInterpretationContext,
  buildFaceUpPresenceCopy,
  buildOpticalInterpretationSummary,
  buildPerformanceReadCopy,
  CONSUMER_TRAIT_UNCERTAIN_HELPER,
  getConsumerLightPerformanceDisplay,
  presentEditorialLightPerformance,
  presentTraitReadLabel,
  interpretationLevelLabel,
  presentClientInterpretationScore,
  opticalBalanceDisplayValue,
  spreadProfileValue,
  type ClientInterpretationSnapshot,
  type ClientLightTrait,
  type ClientSafeMetadata,
  type ClientSafeReportCapability,
  type OverallReadLabel,
} from "@/lib/diamond-intelligence";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import DiamondIntelligenceSynopsis from "./DiamondIntelligenceSynopsis";
import GuidedReportCompletion from "./GuidedReportCompletion";
import OpticalBalanceGraph from "./OpticalBalanceGraph";
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

function TraitBar({
  trait,
  overallScore,
  needsExpertDiagramReview,
  suppressRareLabels,
}: {
  trait: ClientLightTrait;
  overallScore: number | null;
  needsExpertDiagramReview: boolean;
  suppressRareLabels: boolean;
}) {
  const internalLabel = presentTraitReadLabel(trait, overallScore, {
    needsExpertDiagramReview,
    suppressRareLabels,
  });
  const { label: readLabel, uncertain } = getConsumerLightPerformanceDisplay(
    trait,
    internalLabel,
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[13px] text-[#5f5851]">{trait.label}</span>
        <span
          className={`shrink-0 text-right text-[12px] leading-snug ${
            uncertain ? "text-[#948a80]" : "text-[#6f665d]"
          }`}
        >
          {readLabel}
        </span>
      </div>
      {uncertain ? (
        <p className="text-[11px] leading-[1.5] text-[#948a80]">
          {CONSUMER_TRAIT_UNCERTAIN_HELPER}
        </p>
      ) : (
        <div className="h-px overflow-hidden rounded-full bg-[#ebe4da]/90">
          <div
            className="h-full rounded-full bg-[#c4b08a]/80 transition-all duration-500"
            style={{
              width: `${Math.max(trait.fillPercent, 12)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
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
  onInterpretationUpdate,
}: LightPerformanceDashboardProps) {
  const hasReport = Boolean(
    metadata && extractedFields && interpretationFields && capability,
  );

  const fields = interpretationFields ?? extractedFields;
  const levelLabel = capability
    ? interpretationLevelLabel(capability.interpretationLevel)
    : null;

  const clientScore = useMemo(() => {
    if (!fields || !capability) return null;
    return presentClientInterpretationScore(
      fields,
      capability.interpretationLevel,
    );
  }, [fields, capability]);

  const balanceValue =
    clientScore && capability
      ? opticalBalanceDisplayValue(clientScore, capability.interpretationLevel)
      : 0;

  const rawOverallScore =
    clientScore?.eligible && clientScore.overall !== null
      ? clientScore.overall
      : hasReport
        ? balanceValue
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

  const performanceCopy = useMemo(() => {
    if (!capability) return null;
    return buildPerformanceReadCopy({
      overallScore,
      overallLabel: interpretationContext.displayLabel as OverallReadLabel,
      clientScore,
      interpretationLevel: capability.interpretationLevel,
      needsExpertDiagramReview: capability.needsExpertDiagramReview,
      copyTone: interpretationContext.copyTone,
    });
  }, [
    capability,
    overallScore,
    interpretationContext.displayLabel,
    interpretationContext.copyTone,
    clientScore,
  ]);

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

  const centerProfileLabel = hasReport
    ? editorialPresentation.graphCenterLabel
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
          <DashboardCard title="Report" tone="default" className="!p-4 md:!p-5">
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

          <DashboardCard
            title="Performance read"
            tone="primary"
            className="md:p-6"
          >
            {hasReport && clientScore && capability && performanceCopy ? (
              <>
                {!interpretationContext.canShowScore ? (
                  <>
                    <p className="font-serif text-xl text-[#1f1d1a]">
                      {editorialPresentation.tierLabel}
                    </p>
                    <p className="mt-2 text-sm leading-[1.6] text-[#5f5851]">
                      {editorialPresentation.personalityDescriptor}
                    </p>
                    <p className="mt-2 text-sm leading-[1.6] text-[#5f5851]">
                      {interpretationContext.primaryExplanation}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.12em] text-[#a8926a]">
                      Starting point
                    </p>
                  </>
                ) : clientScore.eligible &&
                  clientScore.overall !== null &&
                  overallScore !== null ? (
                  <>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-serif text-[2rem] tracking-tight text-[#1f1d1a] md:text-[2.1rem]">
                        {overallScore}
                        <span className="ml-1.5 text-lg text-[#948a80]">
                          / 100
                        </span>
                      </p>
                      {editorialPresentation.editorialPill ? (
                        <span className="rounded-full border border-[#e4dbcf] bg-[#faf8f4] px-2.5 py-0.5 text-[9px] tracking-[0.14em] text-[#6b5048]">
                          {editorialPresentation.editorialPill}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base font-medium text-[#6b5048]">
                      {editorialPresentation.tierLabel}
                    </p>
                    <p className="mt-1.5 text-sm leading-[1.6] text-[#5f5851]">
                      {editorialPresentation.personalityDescriptor}
                    </p>
                    <p className="mt-2.5 text-sm leading-[1.6] text-[#5f5851]">
                      {performanceCopy.scoreHeadline}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.12em] text-[#a8926a]">
                      {interpretationContext.readState === "full"
                        ? "Estimated read"
                        : "Confidence-adjusted read"}
                    </p>
                    {interpretationContext.readState !== "full" ? (
                      <p className="mt-1 text-[11px] leading-[1.55] text-[#948a80]">
                        Based on the information visible in the report.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-serif text-xl text-[#1f1d1a]">
                      {levelLabel}
                    </p>
                    <p className="mt-2 text-sm leading-[1.6] text-[#5f5851]">
                      {performanceCopy.scoreHeadline}
                    </p>
                  </>
                )}
                {interpretationContext.canShowScore ? (
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#ebe4da]/80">
                    <div
                      className="h-full rounded-full bg-[#c4b08a] transition-all duration-500"
                      style={{ width: `${overallScore ?? balanceValue}%` }}
                    />
                  </div>
                ) : null}
                <div className="mt-5 space-y-2.5 border-t border-[#ebe4da]/60 pt-4">
                  <p className="text-[11px] tracking-[0.14em] text-[#948a80]">
                    What this means
                  </p>
                  <p className="text-[13px] leading-[1.7] text-[#5f5851]">
                    {performanceCopy.whatThisMeans}
                  </p>
                  <p className="text-[12px] leading-[1.65] text-[#6f665d]">
                    {performanceCopy.visualNote}
                  </p>
                  {performanceCopy.conservativeNote ? (
                    <p className="rounded-md border border-[#ebe4da]/70 bg-[#faf8f4]/70 px-3 py-2.5 text-[12px] leading-[1.65] text-[#6f665d]">
                      {performanceCopy.conservativeNote}
                    </p>
                  ) : null}
                  <p className="text-[12px] leading-[1.65] text-[#847a70]">
                    {performanceCopy.confidenceNote}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-[#948a80]">
                Upload a report to see your performance read.
              </p>
            )}
          </DashboardCard>

          <DashboardCard title="Report details" tone="subdued" className="!p-4 md:!p-5">
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

          <div className="rounded-lg border border-[#ebe4da]/80 bg-white/35 px-4 py-4 md:px-5">
            <p className="text-[13px] leading-[1.65] text-[#6f665d]">
              Justin can review the report, proportions, and tradeoffs with you.
            </p>
            <Link
              href="/concierge"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#2b2723] px-4 py-2.5 text-[11px] tracking-[0.14em] text-white transition-opacity hover:opacity-90"
              onClick={() =>
                trackConsultationCtaClicked("diamond_intelligence:dashboard_rail")
              }
            >
              Have Justin review this diamond
            </Link>
          </div>
        </aside>

        <main className="min-w-0 space-y-3.5">
          <section className="overflow-hidden rounded-lg border border-[#e4dbcf]/50 bg-gradient-to-br from-white/65 via-[#fdfbf7]/80 to-[#f5f0e8]/55 shadow-[0_8px_32px_rgba(48,36,28,0.035)]">
            <div className="grid lg:grid-cols-[minmax(0,45%)_minmax(0,55%)]">
              <div className="flex flex-col px-5 py-5 md:px-7 md:py-6 lg:py-8">
                {hasReport && interpretationSummary ? (
                  <>
                    <p className="text-[11px] tracking-[0.18em] text-[#a8926a]">
                      Optical interpretation
                    </p>
                    <p className="mt-3 max-w-md font-serif text-[1.2rem] font-medium leading-[1.48] tracking-[-0.01em] text-[#1f1d1a] md:text-[1.28rem] md:leading-[1.52]">
                      {interpretationSummary}
                    </p>
                    <p className="mt-4 max-w-sm text-[12px] leading-[1.65] text-[#948a80]">
                      Interpretation only — not a laboratory grade. Justin can
                      review the diamond with you before you decide.
                    </p>
                    <Link
                      href="/concierge"
                      className="mt-3.5 inline-flex text-[11px] tracking-[0.12em] text-[#6b5048] underline underline-offset-4"
                      onClick={() =>
                        trackConsultationCtaClicked(
                          "diamond_intelligence:interpretation_summary",
                        )
                      }
                    >
                      Have Justin review this diamond
                    </Link>
                  </>
                ) : (
                  <div className="flex h-full flex-col justify-center py-2">
                    <p className="text-[11px] tracking-[0.18em] text-[#a8926a]">
                      Optical interpretation
                    </p>
                    <p className="mt-3 max-w-md font-serif text-[1.15rem] font-medium leading-[1.5] tracking-[-0.01em] text-[#3a352f] md:text-[1.22rem]">
                      A calm, lab-neutral read of how a diamond is likely to
                      perform in person.
                    </p>
                    <p className="mt-3.5 max-w-sm text-[12.5px] leading-[1.7] text-[#8a8177]">
                      Upload a GIA, IGI, or GCAL report and the balance profile
                      builds alongside a plain-language interpretation — no lab
                      jargon, no scan gimmicks.
                    </p>
                    <div className="mt-5 flex items-center gap-2.5 text-[10px] tracking-[0.16em] text-[#b0a698]">
                      <span className="h-px w-7 bg-[#d8cebf]" />
                      <span>AWAITING REPORT</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col border-t border-[#ebe4da]/35 bg-[#2a2826]/95 px-5 py-5 md:px-7 md:py-6 lg:border-l lg:border-t-0 lg:border-[#ebe4da]/20">
                <p className="text-[10.5px] tracking-[0.2em] text-[#cbc4ba]">
                  PERFORMANCE PROFILE
                </p>
                <p className="mt-2 max-w-xs text-[11px] leading-[1.6] text-[#948e85]">
                  {hasReport && !interpretationContext.canShowGraph
                    ? "Not enough proportion detail yet for a calculated profile."
                    : "Reported proportions translated into a visual balance profile."}
                </p>
                <div className="mt-3 flex flex-1 items-center justify-center">
                  <OpticalBalanceGraph
                    axes={profileAxes}
                    centerLabel={centerProfileLabel}
                    empty={!hasReport || !interpretationContext.canShowGraph}
                    emptyLabel={hasReport ? "STARTING POINT" : "AWAITING REPORT"}
                    emptySubLabel={
                      hasReport && !interpretationContext.canShowGraph
                        ? "AWAITING DETAIL"
                        : undefined
                    }
                    graphMode={interpretationContext.graphMode}
                    strengthMultiplier={
                      interpretationContext.graphStrengthMultiplier
                    }
                  />
                </div>
                <p className="mt-3 border-t border-[#ffffff]/[0.06] pt-3 text-[9.5px] leading-[1.6] tracking-[0.02em] text-[#7c766d]">
                  Profile based on reported proportions and finish details. Not a
                  laboratory scan.
                </p>
              </div>
            </div>
          </section>

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

          <section
            className={`rounded-lg border border-[#ebe4da]/45 bg-white/22 px-4 py-4 md:px-5 md:py-5 ${
              !hasReport ? "opacity-50" : ""
            }`}
          >
            <p className="mb-3.5 text-[10px] tracking-[0.16em] text-[#c4bbb2]">
              Supporting details
            </p>
            <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              <DashboardCard title="Proportions" tone="subdued" className="!shadow-none">
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.tablePercent}
                  value={
                    fields?.tablePercent?.trim()
                      ? `${fields.tablePercent}%`
                      : "—"
                  }
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.depthPercent}
                  value={
                    fields?.depthPercent?.trim()
                      ? `${fields.depthPercent}%`
                      : "—"
                  }
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.crownAngle}
                  value={
                    fields?.crownAngle?.trim()
                      ? `${fields.crownAngle}°`
                      : "—"
                  }
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.pavilionAngle}
                  value={
                    fields?.pavilionAngle?.trim()
                      ? `${fields.pavilionAngle}°`
                      : "—"
                  }
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.girdle}
                  value={dashValue(fields?.girdle)}
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.culet}
                  value={dashValue(fields?.culet)}
                />
              </DashboardCard>

              <DashboardCard title="Finish" tone="subdued" className="!shadow-none">
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.polish}
                  value={dashValue(fields?.polish)}
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.symmetry}
                  value={dashValue(fields?.symmetry)}
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.fluorescence}
                  value={dashValue(fields?.fluorescence)}
                />
                <MetricRow
                  editorial
                  label={CLIENT_FIELD_LABELS.cutGrade}
                  value={dashValue(fields?.cutGrade)}
                />
                <p className="mt-3 text-[11px] leading-[1.5] text-[#948a80]">
                  Finish lines from your report — not a standalone lab grade.
                </p>
              </DashboardCard>

              <DashboardCard title="Face-up presence" tone="subdued" className="!shadow-none">
                {faceUpCopy ? (
                  <>
                    {faceUpCopy.tierLabel ? (
                      <p className="mb-1 text-[11px] tracking-[0.14em] text-[#6b5048]">
                        {faceUpCopy.tierLabel}
                      </p>
                    ) : null}
                    <p className="mb-3 text-sm leading-[1.65] text-[#5f5851]">
                      {faceUpCopy.summary}
                    </p>
                  </>
                ) : null}
                {diameter ? (
                  <MetricRow editorial label="Avg. diameter" value={`${diameter} mm`} />
                ) : null}
                <MetricRow
                  editorial
                  label="Measurements"
                  value={dashValue(fields?.measurements)}
                />
                <MetricRow
                  editorial
                  label="Carat"
                  value={formatCarat(fields?.carat ?? "")}
                />
              </DashboardCard>

              <DashboardCard
                title="Light performance"
                tone="subdued"
                className="!shadow-none md:col-span-2 xl:col-span-1"
              >
                {clientScore &&
                interpretationContext.traitMode !== "review" ? (
                  <div className="space-y-4">
                    {clientScore.lightTraits.map((trait) => (
                      <TraitBar
                        key={trait.label}
                        trait={trait}
                        overallScore={overallScore}
                        needsExpertDiagramReview={
                          capability?.needsExpertDiagramReview ?? false
                        }
                        suppressRareLabels={
                          !interpretationContext.canShowRareLanguage
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] leading-[1.65] text-[#948a80]">
                    Individual light traits become clearer as more proportion
                    detail is confirmed. This is an early read, not a verdict on
                    beauty — Justin can help fill in the rest.
                  </p>
                )}
                <p className="mt-4 text-[11px] leading-[1.55] text-[#948a80]">
                  Trait reads are qualitative, based on reported proportions —
                  not separate lab grades.
                </p>
              </DashboardCard>
            </div>
          </section>

          <footer className="border-t border-[#e4dbcf]/40 pt-2.5 text-[10px] leading-relaxed text-[#948a80]">
            Interpretation uses reported proportions and finish from your upload.
            Not laboratory grades.
          </footer>
        </main>
      </div>
    </div>
  );
}
