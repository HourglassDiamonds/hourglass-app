"use client";

import Link from "next/link";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { VisualPersonality } from "@/lib/diamond-intelligence/visual-personality";
import type { DiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
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
import type { HourglassClarityDisplayPolicy } from "@/lib/diamond-intelligence/hourglass-clarity-policy";
import type { PurchaseRecommendationLabel } from "@/lib/diamond-intelligence/purchase-recommendation-presentation";
import type { V3Gcal8xTier, V3PublicTier } from "./v3-presentation";
import {
  buildV3PercentilePresentation,
  resolveV3IncompleteAssessmentCopy,
  resolveV3IncompleteMissingDataValue,
} from "./v3-presentation";

export type DiV3ResultSectionsProps = {
  showPercentile: boolean;
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
};

export default function DiV3ResultSections({
  showPercentile,
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
}: DiV3ResultSectionsProps) {
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(reportContext);
  const opticalDisplay = presentOpticalPerformanceDisplay(decisionProfile);
  const percentile = showPercentile
    ? buildV3PercentilePresentation(interpretationContext.displayScore, {
        clarity: decisionProfile.gradeHints.clarity,
        color: decisionProfile.gradeHints.color,
        purchaseLabel: purchaseRecommendation,
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
  });

  const humanReviewTitle = isGcal8x
    ? "What Still Benefits From Human Review"
    : "What Still Requires Human Review";

  const humanReviewNote = isGcal8x
    ? "What expert review still adds after optical verification."
    : "What a report cannot fully confirm on its own.";

  const humanReviewParagraphs = isGcal8x
    ? [
        "GCAL 8X gives us substantially more evidence than a standard grading report alone.",
        "Human review still matters because optical verification does not fully answer every buying question.",
      ]
    : ["A grading report tells us a lot. It does not tell us everything."];

  const humanReviewItems = isGcal8x
    ? [
        "Visual personality and pattern preference",
        "Transparency and crystal visibility",
        "Comparative value against other elite candidates",
        "Setting compatibility and buyer priorities",
        "Any nuance not captured by the report alone",
      ]
    : [...limitations];

  const displayTier = displayV3PublicTierLabel(uncappedOpticalTier);
  const cappedDisplayTier = displayV3PublicTierLabel(publicTier);

  const incompleteCopy = resolveV3IncompleteAssessmentCopy(
    decisionProfile.gradeHints,
  );

  const incompleteTechnicalItems: { label: string; value: string }[] = [
    {
      label: "Recommendation Status",
      value: incompleteCopy.recommendationStatus,
    },
    {
      label: "Missing Data",
      value: resolveV3IncompleteMissingDataValue(decisionProfile.gradeHints),
    },
    {
      label: "Optical Read",
      value: incompleteCopy.opticalRead,
    },
    {
      label: "Confidence Level",
      value: incompleteCopy.confidenceLevel,
    },
    {
      label: "Next Step",
      value: incompleteCopy.nextStep,
    },
  ];

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

  if (assessmentIncomplete) {
    return (
      <section className={DI_V3_SECTIONS} aria-label="Diamond Intelligence chapters">
        <DiV3Chapter
          number="01"
          title={incompleteCopy.sectionHeadline}
          note="Partial report read — recommendation not yet complete."
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
          title="What Still Requires Human Review"
          note="What a report cannot fully confirm on its own."
          chapterId="human-review"
        >
          <DiV3BodyParagraphs
            paragraphs={[
              "A grading report tells us a lot. It does not tell us everything.",
            ]}
          />
          <ul className="mt-4 grid list-none gap-3 p-0">
            {limitations.map((item) => (
              <li key={item} className="relative max-w-[68ch] pl-6 text-[#6f665b]">
                <span className="absolute left-0 text-[#b59662]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </DiV3Chapter>

        <DiV3Chapter
          number="03"
          title="Technical Appendix"
          note="Simplified read while the assessment is incomplete."
          chapterId="technical-appendix"
        >
          <DiV3DataGrid items={incompleteTechnicalItems} />
        </DiV3Chapter>
      </section>
    );
  }

  return (
    <section className={DI_V3_SECTIONS} aria-label="Diamond Intelligence chapters">
      <DiV3Chapter
        number="01"
        title="Report Summary"
        note="The clean read before the technical depth."
        chapterId="report-summary"
      >
        <DiV3BodyParagraphs paragraphs={reportSummaryParagraphs} />
        <p className="mt-8 max-w-[68ch] border-t border-[rgba(58,48,38,0.14)] pt-6 text-[14px] leading-[1.72] text-[#75675e]">
          {CONSUMER_COPY.assessmentScopeCopy}
        </p>
      </DiV3Chapter>

      <DiV3Chapter
        number="02"
        title="What You'll Likely Notice"
        note="The visual impression translated into normal language."
        feature
        chapterId="what-youll-likely-notice"
      >
        <p className="mb-5 max-w-none font-serif text-[clamp(32px,4vw,54px)] leading-none text-[#1e1a16]">
          {notice.lead}
        </p>
        <DiV3BodyParagraphs paragraphs={notice.body} />
        {notice.quote ? (
          <p className="mt-6 font-serif text-[25px] leading-tight text-[#1e1a16]">
            {notice.quote}
          </p>
        ) : null}
      </DiV3Chapter>

      <DiV3Chapter
        number="03"
        title="Why This Diamond Earned This Read"
        note={
          isGcal8x
            ? "The performance-class reasons behind the verdict."
            : "The proportion and performance reasons behind the verdict."
        }
        chapterId="why-this-diamond-earned-this-read"
      >
        <DiV3StrengthColumns
          strengths={earnedStrengths}
          limitations={earnedLimitations}
          limitationTitle={isGcal8x ? "Still Worth Confirming" : "Preventing A Higher Read"}
        />
      </DiV3Chapter>

      <DiV3Chapter
        number="04"
        title={
          clarityPolicy.isExcluded
            ? "Recommendation Status"
            : "Optical Performance Spectrum"
        }
        note={
          clarityPolicy.isExcluded
            ? "Hourglass clarity minimum — not a performance comparison."
            : isGcal8x
              ? "The elite 8X ladder, separate from report-only diamonds."
              : "Reported proportions and optical indicators only."
        }
        chapterId="where-it-sits-on-the-spectrum"
      >
        {clarityPolicy.isExcluded ? (
          <DiV3ExcludedClarityStatus />
        ) : isGcal8x && gcal8xTier ? (
          <DiV3Gcal8xSpectrum activeTier={gcal8xTier} />
        ) : (
          <>
            <p className="mb-7 max-w-[68ch] text-[14.5px] leading-[1.62] text-[#6f665b]">
              This spectrum reflects reported proportions and optical indicators
              only. It does not override color, clarity, fluorescence, value, or
              Hourglass standards.
            </p>
            <DiV3StandardSpectrum activeTier={publicTier} />
          </>
        )}
      </DiV3Chapter>

      <DiV3Chapter
        number="05"
        title={humanReviewTitle}
        note={humanReviewNote}
        chapterId="human-review"
      >
        <DiV3BodyParagraphs paragraphs={humanReviewParagraphs} />
        <ul className="mt-4 grid list-none gap-3 p-0">
          {humanReviewItems.map((item) => (
            <li key={item} className="relative max-w-[68ch] pl-6 text-[#6f665b]">
              <span className="absolute left-0 text-[#b59662]">•</span>
              {item}
            </li>
          ))}
        </ul>
        {!isGcal8x ? (
          <p className="mt-[18px] max-w-[68ch]">
            These factors are best evaluated through advanced imagery or direct
            inspection.
          </p>
        ) : null}
      </DiV3Chapter>

      <DiV3Chapter
        number="06"
        title="Justin's Perspective"
        note={isGcal8x ? "The human read after the 8X read." : "The human read after the report read."}
        feature
        chapterId="justins-perspective"
      >
        <DiV3BodyParagraphs paragraphs={justinParagraphs} />
        <Link
          href={conciergeHref}
          className={`${DI_V3_TEXT_CTA} mt-6`}
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:justins_perspective",
            )
          }
        >
          Request Justin&apos;s Review →
        </Link>
      </DiV3Chapter>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <DiV3Chapter
          number="07"
          title="Technical Appendix"
          note="For clients and gemologists who want the deeper read."
          chapterId="technical-appendix"
        >
          <DiV3DataGrid items={technicalItems} />
        </DiV3Chapter>

        <DiV3Chapter
          number="08"
          title="Report Measurements"
          note="The extracted report data used in the assessment."
          chapterId="report-measurements"
        >
          <p className="mb-5 max-w-[68ch] text-sm">
            {CONSUMER_COPY.reportMeasurementsSubcopy}
          </p>
          <DiV3DataGrid items={measurementItems} />
        </DiV3Chapter>
      </div>
    </section>
  );
}

