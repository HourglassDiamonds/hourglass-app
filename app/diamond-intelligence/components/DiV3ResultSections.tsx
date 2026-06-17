"use client";

import Link from "next/link";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { VisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import type { DiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence/client-api";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CLIENT_FIELD_LABELS } from "@/lib/diamond-intelligence";
import { presentOpticalPerformanceDisplay } from "@/lib/diamond-intelligence/interpretation-display";
import {
  buildJustinPerspectiveParagraphs,
  buildV3EarnedLimitations,
  buildV3NoticePresentation,
  buildV3ReportSummaryParagraphs,
  displayV3PublicTierLabel,
} from "@/lib/diamond-intelligence/v3-editorial-narrative";
import {
  consumerConfidenceBandLabel,
  consumerProfileDimensionLabel,
  CONSUMER_COPY,
} from "./consumer-display-labels";
import { dashValue } from "./DashboardCard";
import DiV3Chapter from "./DiV3Chapter";
import {
  DiV3BodyParagraphs,
  DiV3DataGrid,
  DiV3ExcludedClarityStatus,
  DiV3Gcal8xSpectrum,
  DiV3StandardSpectrum,
  DiV3StrengthColumns,
} from "./DiV3SpectrumSection";
import { DI_V3_SECTIONS, DI_V3_TEXT_CTA } from "./di-v3-styles";
import type { DecisionConfidenceBand } from "@/lib/diamond-intelligence/decision-profile-confidence";
import type { HourglassClarityDisplayPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import type { PurchaseRecommendationLabel } from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import type { V3Gcal8xTier, V3PublicTier } from "./v3-presentation";
import type { LgdrEffectiveFinish } from "@/lib/diamond-intelligence/lgdr-presentation-policy";
import {
  buildV3PercentilePresentation,
  buildV3FancyShapeTechnicalItems,
  buildV3IncompleteTechnicalItems,
  HOURGLASS_PERSPECTIVE_COPY,
  resolveV3FancyShapeAssessmentCopy,
  resolveV3IncompleteAssessmentCopy,
  shouldShowHourglassPerspective,
} from "./v3-presentation";
import { buildFancyShapeReportDetailItems } from "@/lib/diamond-intelligence/fancy-shape-presentation";
import DiAdvisoryCta from "./DiAdvisoryCta";

export type DiV3ResultSectionsProps = {
  showPercentile: boolean;
  presentationMetadata?: ClientSafeMetadata | null;
  reportTextHint?: string;
  naturalGiaPercentileCaution?: boolean;
  lgdrPercentileCaution?: boolean;
  lgdrEffectiveFinish?: LgdrEffectiveFinish;
  isGcal8x: boolean;
  clarityPolicy: HourglassClarityDisplayPolicy;
  publicTier: V3PublicTier;
  uncappedOpticalTier: V3PublicTier;
  gcal8xTier: V3Gcal8xTier | null;
  purchaseRecommendation: PurchaseRecommendationLabel;
  interpretationSummary: string;
  visualPersonality: VisualPersonality | null;
  strengths: string[];
  worthKnowing: string[];
  limitations: readonly string[];
  decisionProfile: DiamondDecisionProfile;
  interpretationContext: DiamondInterpretationContext;
  fields: CalibrationReportFields;
  diameter: string | null;
  formatCarat: (carat: string) => string;
  reportContext: DiamondIntelligenceConciergeContext;
  assessmentIncomplete?: boolean;
  assessmentFancyShape?: boolean;
  fancyShapePresentation?: boolean;
  fancyShapeLabel?: string | null;
};

export default function DiV3ResultSections({
  showPercentile,
  presentationMetadata,
  reportTextHint,
  naturalGiaPercentileCaution = false,
  lgdrPercentileCaution = false,
  lgdrEffectiveFinish,
  isGcal8x,
  clarityPolicy,
  publicTier,
  uncappedOpticalTier,
  gcal8xTier,
  purchaseRecommendation,
  interpretationSummary,
  visualPersonality,
  strengths,
  worthKnowing,
  limitations,
  decisionProfile,
  interpretationContext,
  fields,
  diameter,
  formatCarat,
  reportContext,
  assessmentIncomplete = false,
  assessmentFancyShape = false,
  fancyShapePresentation = false,
  fancyShapeLabel = null,
}: DiV3ResultSectionsProps) {
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(reportContext);
  const opticalDisplay = presentOpticalPerformanceDisplay(decisionProfile);
  const percentile = showPercentile
    ? buildV3PercentilePresentation(interpretationContext.displayScore, {
        clarity: decisionProfile.gradeHints.clarity,
        color: decisionProfile.gradeHints.color,
        purchaseLabel: purchaseRecommendation,
        naturalGiaPercentileCaution,
        lgdrPercentileCaution,
      })
    : null;

  const reportSummaryParagraphs = buildV3ReportSummaryParagraphs({
    clarityPolicy,
    isGcal8x,
    fields,
    gradeHints: decisionProfile.gradeHints,
    purchaseRecommendation,
    uncappedOpticalTier,
    interpretationSummary,
  });

  const notice = buildV3NoticePresentation({
    clarityPolicy,
    isGcal8x,
    visualPersonality,
    purchaseRecommendation,
    opticalBand: decisionProfile.opticalPerformance.band,
  });

  const earnedStrengths = clarityPolicy.isExcluded
    ? [
        "Report proportions may still read acceptably on paper",
        "Laboratory grade on the report is acknowledged as stated",
      ]
    : isGcal8x
      ? [
          "GCAL 8X performance verification is present",
          "Optical evidence supports the report-level read",
          "Light return indicators appear strongly supported",
          "Assessment begins from an elite cut-performance baseline",
        ]
      : strengths;

  const earnedLimitations = buildV3EarnedLimitations({
    clarityPolicy,
    isGcal8x,
    worthKnowing,
  });

  const justinParagraphs = buildJustinPerspectiveParagraphs({
    clarityPolicy,
    isGcal8x,
    decisionProfile,
    fields,
    metadata: presentationMetadata,
    reportTextHint,
  });

  const humanReviewTitle = "Worth Confirming In Person";

  const humanReviewNote = isGcal8x
    ? "What expert review still adds after optical verification."
    : "Calm, practical checks before you commit — not warnings.";

  const humanReviewParagraphs = isGcal8x
    ? [
        "GCAL 8X gives us substantially more evidence than a standard grading report alone.",
        "A brief in-person or advanced-imagery review still helps confirm the details that matter most to you.",
      ]
    : [
        "A grading report tells us a lot. These are the details worth confirming before you decide.",
      ];

  const humanReviewItems = isGcal8x
    ? [
        "Visual personality and how the pattern reads to you",
        "Transparency and crystal visibility under everyday light",
        "How it compares against other elite candidates you are considering",
        "Setting compatibility and what matters most in your search",
        "Subtle details the report alone cannot fully capture",
      ]
    : [...limitations];

  const displayTier = displayV3PublicTierLabel(uncappedOpticalTier);
  const cappedDisplayTier = displayV3PublicTierLabel(publicTier);

  const incompleteCopy = resolveV3IncompleteAssessmentCopy(
    decisionProfile.gradeHints,
    {
      confidenceBand: decisionProfile.confidence
        .band as DecisionConfidenceBand,
    },
  );

  const incompleteTechnicalItems = buildV3IncompleteTechnicalItems(incompleteCopy);

  const technicalItems: { label: string; value: string }[] = assessmentIncomplete
    ? incompleteTechnicalItems
    : isGcal8x
    ? [
        { label: "Assessment Context", value: "GCAL 8X Class" },
        { label: "Optical Performance Read", value: gcal8xTier ?? "—" },
        { label: "Optical Verification", value: "Present" },
        { label: "Brightness", value: opticalDisplay.band },
        { label: "Report Confidence", value: consumerConfidenceBandLabel(decisionProfile.confidence.band) },
      ]
    : [
        {
          label: "Optical Performance Read",
          value: clarityPolicy.isExcluded ? cappedDisplayTier : displayTier,
        },
        ...(clarityPolicy.isExcluded
          ? [{ label: "Hourglass Standards", value: "Outside Standards" }]
          : percentile
            ? [
                {
                  label: "Optical Percentile",
                  value: `${percentile.topLine} ${percentile.topSubline}`,
                },
              ]
            : []),
        {
          label: "Purchase Recommendation",
          value: purchaseRecommendation,
        },
        {
          label: "Purchase Personality",
          value: decisionProfile.purchasePersonality.label,
        },
        { label: "Brightness", value: decisionProfile.opticalPerformance.band },
        { label: "Visual Presence", value: decisionProfile.visualPresence.band },
        { label: "Leakage Risk", value: decisionProfile.riskProfile.band },
        {
          label: "Report Confidence",
          value: consumerConfidenceBandLabel(decisionProfile.confidence.band),
        },
        {
          label: "Performance Read",
          value: consumerProfileDimensionLabel(decisionProfile.opticalPerformance.label),
        },
      ];

  const measurementItems: { label: string; value: string }[] = [];
  const pushMeasurement = (label: string, value: string) => {
    if (value && value !== "—") measurementItems.push({ label, value });
  };

  pushMeasurement(
    CLIENT_FIELD_LABELS.tablePercent,
    fields.tablePercent?.trim() ? `${fields.tablePercent}%` : "—",
  );
  pushMeasurement(
    CLIENT_FIELD_LABELS.depthPercent,
    fields.depthPercent?.trim() ? `${fields.depthPercent}%` : "—",
  );
  pushMeasurement(
    CLIENT_FIELD_LABELS.crownAngle,
    fields.crownAngle?.trim() ? `${fields.crownAngle}°` : "—",
  );
  pushMeasurement(
    CLIENT_FIELD_LABELS.pavilionAngle,
    fields.pavilionAngle?.trim() ? `${fields.pavilionAngle}°` : "—",
  );
  pushMeasurement(CLIENT_FIELD_LABELS.starLengthPercent, fields.starLengthPercent?.trim() ? `${fields.starLengthPercent}%` : "—");
  pushMeasurement(CLIENT_FIELD_LABELS.lowerHalfPercent, fields.lowerHalfPercent?.trim() ? `${fields.lowerHalfPercent}%` : "—");
  pushMeasurement(CLIENT_FIELD_LABELS.girdle, dashValue(fields.girdle));
  pushMeasurement(CLIENT_FIELD_LABELS.culet, dashValue(fields.culet));
  pushMeasurement(CLIENT_FIELD_LABELS.polish, dashValue(fields.polish));
  pushMeasurement(CLIENT_FIELD_LABELS.symmetry, dashValue(fields.symmetry));
  pushMeasurement(CLIENT_FIELD_LABELS.fluorescence, dashValue(fields.fluorescence));
  if (diameter) pushMeasurement("Avg. diameter", `${diameter} mm`);
  pushMeasurement("Carat", formatCarat(fields.carat ?? ""));

  if (diameter) pushMeasurement("Avg. diameter", `${diameter} mm`);
  pushMeasurement("Carat", formatCarat(fields.carat ?? ""));

  if (assessmentFancyShape && fancyShapePresentation) {
    const fancyCopy = resolveV3FancyShapeAssessmentCopy(fancyShapeLabel);
    const fancyTechnicalItems = buildV3FancyShapeTechnicalItems(fancyCopy);
    const reportDetailItems = buildFancyShapeReportDetailItems({
      fields,
      gradeHints: decisionProfile.gradeHints,
      displayShape: fancyShapeLabel ?? fields.shape?.trim() ?? "Fancy Shape",
      formatCarat,
    });

    return (
      <section className={DI_V3_SECTIONS} aria-label="Diamond Intelligence chapters">
        <DiV3Chapter
          number="01"
          title={fancyCopy.sectionHeadline}
          note={fancyCopy.chapterNote}
          chapterId="fancy-shape-assessment"
        >
          <DiV3BodyParagraphs
            paragraphs={[fancyCopy.subhead, fancyCopy.sectionBody]}
          />
        </DiV3Chapter>

        <DiV3Chapter
          number="02"
          title="Justin's Perspective"
          note="A personal note on fancy-shape review."
          feature
          advisor
          chapterId="justins-perspective"
        >
          <DiV3BodyParagraphs paragraphs={[fancyCopy.justinNote]} />
          <p className="mt-6 text-[13px] tracking-[0.04em] text-[#8a8177]">
            Justin Smith, GG
          </p>
          <Link
            href={conciergeHref}
            className={`${DI_V3_TEXT_CTA} mt-5 text-[13px] text-[#8a8177]`}
            onClick={() =>
              trackConsultationCtaClicked(
                "diamond_intelligence:justins_perspective",
              )
            }
          >
            {CONSUMER_COPY.justinReviewCta} →
          </Link>
        </DiV3Chapter>

        <DiV3Chapter
          number="03"
          title="Report Details"
          note="Extracted values from the uploaded report."
          chapterId="fancy-shape-report-details"
        >
          <p className="mb-5 max-w-[62ch] text-[13px] leading-[1.65] text-[#8a8177]">
            {CONSUMER_COPY.reportMeasurementsSubcopy}
          </p>
          <DiV3DataGrid items={reportDetailItems} />
        </DiV3Chapter>

        <DiV3Chapter
          number="04"
          title="Technical Context"
          note="How this read is scoped for fancy shapes."
          chapterId="fancy-shape-technical-appendix"
          demoted
        >
          <DiV3DataGrid items={fancyTechnicalItems} />
          <p className="mt-5 max-w-[68ch] text-[14px] leading-[1.72] text-[#75675e]">
            {fancyCopy.technicalAppendixNote}
          </p>
        </DiV3Chapter>

        <DiAdvisoryCta conciergeHref={conciergeHref} />
      </section>
    );
  }

  if (assessmentIncomplete) {
    return (
      <section className={DI_V3_SECTIONS} aria-label="Diamond Intelligence chapters">
        <DiV3Chapter
          number="01"
          title={incompleteCopy.sectionHeadline}
          note={incompleteCopy.chapterNote}
          chapterId="incomplete-assessment"
        >
          <DiV3BodyParagraphs
            paragraphs={[
              incompleteCopy.subhead,
              incompleteCopy.sectionBody,
            ]}
          />
        </DiV3Chapter>

        <DiV3Chapter
          number="02"
          title="Worth Confirming In Person"
          note={
            incompleteCopy.kind === "proportion"
              ? "Grades are confirmed — these limits apply to any report-based read."
              : "Practical next steps before the read can be completed."
          }
          chapterId="human-review"
        >
          <DiV3BodyParagraphs
            paragraphs={[
              "A grading report tells us a lot. These are the details worth confirming before you decide.",
            ]}
          />
          <ul className="mt-5 grid list-none gap-[14px] p-0">
            {limitations.map((item) => (
              <li key={item} className="relative max-w-[62ch] pl-5 text-[15px] leading-[1.72] text-[#6f665b]">
                <span className="absolute left-0 text-[#b59662]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </DiV3Chapter>

        <DiV3Chapter
          number="03"
          title="Report Details"
          note={
            incompleteCopy.kind === "proportion"
              ? "Grades are present — proportion confirmation is still pending."
              : "Technical context while grading detail is still pending."
          }
          chapterId="technical-appendix"
          demoted
        >
          <DiV3DataGrid items={incompleteTechnicalItems} />
          <p className="mt-5 max-w-[68ch] text-[14px] leading-[1.72] text-[#75675e]">
            {incompleteCopy.technicalAppendixNote}
          </p>
        </DiV3Chapter>
      </section>
    );
  }

  const showHourglassPerspective = shouldShowHourglassPerspective(
    fields,
    lgdrEffectiveFinish,
  );
  const chapterOffset = showHourglassPerspective ? 1 : 0;
  const chapterNum = (base: number) =>
    String(base + chapterOffset).padStart(2, "0");

  return (
    <section className={DI_V3_SECTIONS} aria-label="Diamond Intelligence chapters">
      <DiV3Chapter
        number="01"
        title="What You'll Likely Notice"
        note="The visual impression, in plain language."
        feature
        chapterId="what-youll-likely-notice"
      >
        <p className="mb-7 max-w-none font-serif text-[clamp(34px,4.8vw,58px)] leading-[1.04] tracking-[-0.02em] text-[#1e1a16]">
          {notice.lead}
        </p>
        <DiV3BodyParagraphs paragraphs={notice.body} />
        {notice.quote ? (
          <p className="mt-8 max-w-[52ch] border-l border-[rgba(181,150,98,0.45)] pl-5 text-[15px] leading-[1.78] text-[#514536] md:text-[16px] md:leading-[1.82]">
            {notice.quote}
          </p>
        ) : null}
      </DiV3Chapter>

      <DiV3Chapter
        number="02"
        title="Justin's Perspective"
        note={isGcal8x ? "The human read after the 8X read." : "A personal note after the report read."}
        feature
        advisor
        chapterId="justins-perspective"
      >
        <div className="grid max-w-[62ch] gap-5 text-[16px] leading-[1.82] text-[#5f5851] md:text-[17px] md:leading-[1.86]">
          {justinParagraphs.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}
        </div>
        <p className="mt-6 text-[13px] tracking-[0.04em] text-[#8a8177]">
          Justin Smith, GG
        </p>
        <Link
          href={conciergeHref}
          className={`${DI_V3_TEXT_CTA} mt-5 text-[13px] text-[#8a8177]`}
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:justins_perspective",
            )
          }
        >
          {CONSUMER_COPY.justinReviewCta} →
        </Link>
      </DiV3Chapter>

      {showHourglassPerspective ? (
        <DiV3Chapter
          number="03"
          title="The Hourglass Perspective"
          note="How we think about finish on round brilliants."
          feature
          chapterId="hourglass-perspective"
        >
          <DiV3BodyParagraphs paragraphs={[...HOURGLASS_PERSPECTIVE_COPY]} />
        </DiV3Chapter>
      ) : null}

      <DiV3Chapter
        number={chapterNum(3)}
        title="Why This Earned This Read"
        note={
          isGcal8x
            ? "The performance-class reasons behind the verdict."
            : "The proportion and performance reasons behind the verdict."
        }
        chapterId="why-this-earned-this-read"
      >
        <DiV3BodyParagraphs paragraphs={reportSummaryParagraphs} />
        <div className="mt-8 border-t border-[rgba(58,48,38,0.10)] pt-8">
          <DiV3StrengthColumns
            strengths={earnedStrengths}
            limitations={earnedLimitations}
            limitationTitle="Potential Areas to Keep in Mind"
          />
        </div>
      </DiV3Chapter>

      <DiV3Chapter
        number={chapterNum(4)}
        title={
          clarityPolicy.isExcluded
            ? "Recommendation Status"
            : "Recommendation Spectrum"
        }
        note={
          clarityPolicy.isExcluded
            ? "Hourglass clarity minimum — not a performance comparison."
            : isGcal8x
              ? "The elite 8X ladder, separate from report-only diamonds."
              : "An editorial classification from reported proportions and optical indicators."
        }
        chapterId="where-it-sits-on-the-spectrum"
      >
        {clarityPolicy.isExcluded ? (
          <DiV3ExcludedClarityStatus />
        ) : isGcal8x && gcal8xTier ? (
          <DiV3Gcal8xSpectrum activeTier={gcal8xTier} />
        ) : (
          <>
            <p className="mb-6 max-w-[62ch] text-[14px] leading-[1.65] text-[#8a8177]">
              This spectrum reflects reported proportions and optical indicators
              only. It does not override color, clarity, fluorescence, value, or
              Hourglass standards.
            </p>
            <DiV3StandardSpectrum activeTier={publicTier} />
          </>
        )}
      </DiV3Chapter>

      <DiV3Chapter
        number={chapterNum(5)}
        title={humanReviewTitle}
        note={humanReviewNote}
        chapterId="human-review"
      >
        <DiV3BodyParagraphs paragraphs={humanReviewParagraphs} />
        <ul className="mt-5 grid list-none gap-[14px] p-0">
          {humanReviewItems.map((item) => (
            <li key={item} className="relative max-w-[62ch] pl-5 text-[15px] leading-[1.72] text-[#6f665b]">
              <span className="absolute left-0 text-[#b59662]">•</span>
              {item}
            </li>
          ))}
        </ul>
        {!isGcal8x ? (
          <p className="mt-6 max-w-[62ch] text-[14px] leading-[1.68] text-[#8a8177]">
            These factors are best evaluated through advanced imagery or direct
            inspection — a normal part of choosing well.
          </p>
        ) : null}
      </DiV3Chapter>

      <DiAdvisoryCta conciergeHref={conciergeHref} />

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <DiV3Chapter
          number={chapterNum(6)}
          title="Report Details"
          note="Technical context for clients and gemologists."
          chapterId="technical-appendix"
          demoted
        >
          <DiV3DataGrid items={technicalItems} />
          <p className="mt-6 max-w-[62ch] text-[13px] leading-[1.68] text-[#8a8177]">
            {CONSUMER_COPY.assessmentScopeCopy}
          </p>
        </DiV3Chapter>

        <DiV3Chapter
          number={chapterNum(7)}
          title="Report Measurements"
          note="Extracted values from the uploaded report."
          chapterId="report-measurements"
          demoted
        >
          <p className="mb-5 max-w-[62ch] text-[13px] leading-[1.65] text-[#8a8177]">
            {CONSUMER_COPY.reportMeasurementsSubcopy}
          </p>
          <DiV3DataGrid items={measurementItems} />
        </DiV3Chapter>
      </div>
    </section>
  );
}

