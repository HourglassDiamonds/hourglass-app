"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  CLIENT_FIELD_LABELS,
  ESTIMATED_COMPARISON_BAND_CAPTION,
  buildFaceUpPresenceCopy,
  buildOpticalCharacterCopy,
  buildOpticalInterpretationSummary,
  buildPerformanceReadCopy,
  presentOverallReadLabel,
  presentTraitReadLabel,
  interpretationLevelLabel,
  presentClientInterpretationScore,
  opticalBalanceDisplayValue,
  type ClientInterpretationSnapshot,
  type ClientLightTrait,
  type ClientSafeMetadata,
  type ClientSafeReportCapability,
} from "@/lib/diamond-intelligence";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import DiamondIntelligenceSynopsis from "./DiamondIntelligenceSynopsis";
import GuidedReportCompletion from "./GuidedReportCompletion";
import OpticalHeroStage from "./OpticalHeroStage";
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
}: {
  trait: ClientLightTrait;
  overallScore: number | null;
}) {
  const readLabel = presentTraitReadLabel(trait, overallScore);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
        <span className="text-[#5f5851]">{trait.label}</span>
        <span className="shrink-0 text-right text-[#8a8177]">{readLabel}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#ebe4da]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c4b08a] to-[#a8926a] transition-all duration-500"
          style={{
            width: `${Math.max(trait.fillPercent, trait.level === "Needs review" ? 8 : 12)}%`,
          }}
        />
      </div>
    </div>
  );
}

export type LightPerformanceDashboardProps = {
  fileName: string | null;
  uploadPhase: ClientUploadPhase;
  uploadError: string | null;
  onFile: (file: File) => void;
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
  onFile,
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

  const overallScore =
    clientScore?.eligible && clientScore.overall !== null
      ? clientScore.overall
      : hasReport
        ? balanceValue
        : null;

  const overallRead = useMemo(
    () => presentOverallReadLabel(overallScore),
    [overallScore],
  );

  const diameter =
    fields?.measurements ? parseAverageDiameterMm(fields.measurements) : null;

  const diameterNum = diameter ? parseFloat(diameter) : null;

  const performanceCopy = useMemo(() => {
    if (!capability) return null;
    return buildPerformanceReadCopy({
      overallScore,
      overallLabel: overallRead.label,
      clientScore,
      interpretationLevel: capability.interpretationLevel,
      needsExpertDiagramReview: capability.needsExpertDiagramReview,
    });
  }, [capability, overallScore, overallRead.label, clientScore]);

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
      overallLabel: overallRead.label,
      needsExpertDiagramReview: capability.needsExpertDiagramReview,
    });
  }, [capability, clientScore, overallRead.label]);

  const opticalCharacterCopy = useMemo(() => {
    if (!capability) {
      return "Upload a report to see how brightness, fire, and contrast read together on the hand.";
    }
    return buildOpticalCharacterCopy({
      interpretationLevel: capability.interpretationLevel,
      overallLabel: overallRead.label,
      needsExpertDiagramReview: capability.needsExpertDiagramReview,
    });
  }, [capability, overallRead.label]);

  const busy = uploadPhase !== "idle";

  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-10 pt-5 md:px-6">
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
          Light Performance
        </p>
        <h1 className="mt-1.5 font-serif text-2xl font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.65rem]">
          Diamond Intelligence
        </h1>
      </div>

      <DiamondIntelligenceSynopsis />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr] xl:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="flex flex-col gap-3.5 lg:max-w-[330px]">
          <DashboardCard title="Report">
            <ReportUploadDock
              phase={uploadPhase}
              disabled={busy}
              errorMessage={uploadError}
              onFile={onFile}
              metadata={hasReport ? metadata : null}
              fileName={fileName}
            />
          </DashboardCard>

          <DashboardCard title="Report details">
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
              <p className="text-xs leading-relaxed text-[#948a80]">
                Report details appear after upload.
              </p>
            )}
          </DashboardCard>

          <DashboardCard
            title="Performance read"
            className="ring-1 ring-[#e8dcc8]/70 shadow-[0_12px_36px_rgba(168,146,106,0.1)]"
          >
            {hasReport && clientScore && capability && performanceCopy ? (
              <>
                {clientScore.eligible && clientScore.overall !== null ? (
                  <>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-serif text-[2rem] tracking-tight text-[#1f1d1a]">
                        {clientScore.overall}
                        <span className="ml-1 text-base text-[#948a80]">
                          / 100
                        </span>
                      </p>
                      {overallRead.showRarePill && overallRead.pillText ? (
                        <span className="rounded-full border border-[#e4dbcf] bg-[#faf8f4] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[#6b5048]">
                          {overallRead.pillText}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#6b5048]">
                      {overallRead.label}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[#a8926a]">
                      Estimated read
                    </p>
                    {overallRead.showRarePill ? (
                      <p className="mt-1 text-[9px] text-[#948a80]">
                        {ESTIMATED_COMPARISON_BAND_CAPTION}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="font-serif text-lg text-[#1f1d1a]">
                    {levelLabel}
                  </p>
                )}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe4da]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#c4b08a] to-[#a8926a] transition-all duration-500"
                    style={{ width: `${balanceValue}%` }}
                  />
                </div>
                <div className="mt-4 space-y-2 border-t border-[#ebe4da]/80 pt-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#948a80]">
                    What this means
                  </p>
                  <p className="text-xs leading-relaxed text-[#5f5851]">
                    {performanceCopy.whatThisMeans}
                  </p>
                  <p className="text-[11px] leading-snug text-[#6f665d]">
                    {performanceCopy.visualNote}
                  </p>
                  <p className="text-[11px] leading-snug text-[#847a70]">
                    {performanceCopy.confidenceNote}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-[#948a80]">
                Upload a report to see your performance read.
              </p>
            )}
          </DashboardCard>

          <DashboardCard
            title="Optical character"
            className="ring-1 ring-[#ebe4da]/60"
          >
            <p className="text-sm leading-relaxed text-[#5f5851]">
              {opticalCharacterCopy}
            </p>
          </DashboardCard>

          <DashboardCard title="Expert review">
            <p className="text-xs leading-relaxed text-[#5f5851]">
              Justin can review the report, proportions, and tradeoffs with you.
            </p>
            <Link
              href="/concierge"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#2b2723] px-4 py-2.5 text-[10px] uppercase tracking-[0.24em] text-white transition-opacity hover:opacity-90"
              onClick={() =>
                trackConsultationCtaClicked("diamond_intelligence:dashboard_rail")
              }
            >
              Have Justin review this diamond
            </Link>
          </DashboardCard>
        </aside>

        <main className="min-w-0 space-y-3">
          <OpticalHeroStage empty={!hasReport} />

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

          {hasReport && capability && interpretationSummary ? (
            <section className="rounded-lg border border-[#d4c4a8]/50 bg-white/70 p-5 shadow-[0_12px_40px_rgba(48,36,28,0.06)] ring-1 ring-[#e8dcc8]/60 md:p-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#a8926a]">
                Optical interpretation
              </p>
              <p className="mt-3 font-serif text-lg leading-snug text-[#1f1d1a] md:text-xl">
                {interpretationSummary}
              </p>
              <p className="mt-3 text-[11px] leading-snug text-[#948a80]">
                Interpretation only — not a laboratory grade. Justin can review
                the report with you before you decide.
              </p>
              <Link
                href="/concierge"
                className="mt-4 inline-flex text-[10px] uppercase tracking-[0.24em] text-[#6b5048] underline underline-offset-4"
                onClick={() =>
                  trackConsultationCtaClicked(
                    "diamond_intelligence:interpretation_summary",
                  )
                }
              >
                Have Justin review this diamond
              </Link>
            </section>
          ) : null}

          <p
            className={`text-[10px] uppercase tracking-[0.28em] text-[#b8afa6] ${
              !hasReport ? "opacity-50" : ""
            }`}
          >
            Supporting details from your report
          </p>

          <div
            className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${
              !hasReport ? "opacity-50" : ""
            }`}
          >
            <DashboardCard title="Proportions" className="bg-white/45">
              <MetricRow
                label={CLIENT_FIELD_LABELS.tablePercent}
                value={
                  fields?.tablePercent?.trim()
                    ? `${fields.tablePercent}%`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.depthPercent}
                value={
                  fields?.depthPercent?.trim()
                    ? `${fields.depthPercent}%`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.crownAngle}
                value={
                  fields?.crownAngle?.trim()
                    ? `${fields.crownAngle}°`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.pavilionAngle}
                value={
                  fields?.pavilionAngle?.trim()
                    ? `${fields.pavilionAngle}°`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.lowerHalfPercent}
                value={
                  fields?.lowerHalfPercent?.trim()
                    ? `${fields.lowerHalfPercent}%`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.starLengthPercent}
                value={
                  fields?.starLengthPercent?.trim()
                    ? `${fields.starLengthPercent}%`
                    : "—"
                }
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.girdle}
                value={dashValue(fields?.girdle)}
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.culet}
                value={dashValue(fields?.culet)}
              />
            </DashboardCard>

            <DashboardCard title="Finish" className="bg-white/45">
              <MetricRow
                label={CLIENT_FIELD_LABELS.polish}
                value={dashValue(fields?.polish)}
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.symmetry}
                value={dashValue(fields?.symmetry)}
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.fluorescence}
                value={dashValue(fields?.fluorescence)}
              />
              <MetricRow
                label={CLIENT_FIELD_LABELS.cutGrade}
                value={dashValue(fields?.cutGrade)}
              />
              <p className="mt-3 text-[10px] leading-snug text-[#948a80]">
                Finish lines from your report — not a standalone lab grade here.
              </p>
            </DashboardCard>

            <DashboardCard title="Face-up presence" className="bg-white/45">
              {faceUpCopy ? (
                <p className="mb-3 text-sm leading-relaxed text-[#5f5851]">
                  {faceUpCopy.summary}
                </p>
              ) : null}
              {diameter ? (
                <MetricRow label="Avg. diameter" value={`${diameter} mm`} />
              ) : null}
              <MetricRow
                label="Measurements"
                value={dashValue(fields?.measurements)}
              />
              <MetricRow label="Carat" value={formatCarat(fields?.carat ?? "")} />
              <p className="mt-3 text-[10px] leading-snug text-[#948a80]">
                {faceUpCopy?.footnote ??
                  "Face-up presence depends on measurements and carat weight together."}
              </p>
            </DashboardCard>

            <DashboardCard title="Light performance" className="bg-white/45">
              {clientScore ? (
                <div className="space-y-3">
                  {clientScore.lightTraits.map((trait) => (
                    <TraitBar
                      key={trait.label}
                      trait={trait}
                      overallScore={overallScore}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#948a80]">—</p>
              )}
              <p className="mt-3 text-[10px] leading-snug text-[#948a80]">
                Trait reads are qualitative, based on reported proportions — not
                separate lab grades.
              </p>
            </DashboardCard>

            <DashboardCard title="Optical balance" className="bg-white/45">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[#e4dbcf]"
                    style={{
                      background: hasReport
                        ? `conic-gradient(#c4b08a ${balanceValue * 3.6}deg, #ebe4da 0deg)`
                        : "#ebe4da",
                    }}
                  >
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white/95">
                      <span className="font-serif text-xl text-[#1f1d1a]">
                        {hasReport ? balanceValue : "—"}
                      </span>
                      {hasReport ? (
                        <span className="text-[8px] text-[#948a80]">/ 100</span>
                      ) : null}
                    </div>
                  </div>
                  {hasReport ? (
                    <>
                      {overallRead.showRarePill && overallRead.pillText ? (
                        <span className="rounded-full border border-[#e4dbcf] bg-[#faf8f4] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[#6b5048]">
                          {overallRead.pillText}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[#6b5048]">
                          {overallRead.label}
                        </span>
                      )}
                      {overallRead.showRarePill ? (
                        <p className="text-center text-[9px] text-[#948a80]">
                          {ESTIMATED_COMPARISON_BAND_CAPTION}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <ul className="space-y-1.5 text-[11px] text-[#5f5851]">
                  <li>Estimated read from reported proportions</li>
                  <li>{levelLabel ?? "Awaiting report"}</li>
                  <li className="text-[#948a80]">
                    Interpretation only — not a laboratory grade
                  </li>
                </ul>
              </div>
            </DashboardCard>

          </div>

          <footer className="mt-1 border-t border-[#e4dbcf]/50 pt-3 text-[10px] leading-relaxed text-[#948a80]">
            Interpretation uses reported proportions and finish from your upload.
            Not laboratory grades.
          </footer>
        </main>
      </div>
    </div>
  );
}
