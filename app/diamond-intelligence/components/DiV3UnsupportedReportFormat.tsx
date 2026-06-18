"use client";

import Link from "next/link";
import { useRef } from "react";
import { DI_CLIENT_ACCEPT } from "@/lib/diamond-intelligence/upload-accept";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import {
  CLIENT_UNSUPPORTED_REPORT_FORMAT_BODY,
  CLIENT_UNSUPPORTED_REPORT_FORMAT_CTA,
  CLIENT_UNSUPPORTED_REPORT_FORMAT_EYEBROW,
  CLIENT_UNSUPPORTED_REPORT_FORMAT_HEADLINE,
} from "@/lib/diamond-intelligence/unsupported-report-format-copy";
import { CONSUMER_COPY } from "./consumer-display-labels";
import {
  DI_V3_BRAND,
  DI_V3_PARTIAL_CARD,
  DI_V3_PRODUCT,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export default function DiV3UnsupportedReportFormat({
  onFile,
  reportContext,
}: {
  onFile: (file: File) => void;
  reportContext?: DiamondIntelligenceConciergeContext;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  return (
    <article className={DI_V3_PARTIAL_CARD}>
      <div className="mb-8">
        <div className={DI_V3_BRAND}>Hourglass Diamonds</div>
        <div className={`${DI_V3_PRODUCT} mt-3.5`}>Diamond Intelligence</div>
      </div>

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#9b8b78]">
        {CLIENT_UNSUPPORTED_REPORT_FORMAT_EYEBROW}
      </p>

      <h1 className="mt-4 font-serif text-[clamp(34px,5.5vw,52px)] font-normal uppercase leading-[0.98] tracking-[0.035em] text-[#1e1a16]">
        {CLIENT_UNSUPPORTED_REPORT_FORMAT_HEADLINE}
      </h1>

      <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.72] text-[#6f665b]">
        {CLIENT_UNSUPPORTED_REPORT_FORMAT_BODY}
      </p>

      <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.72] text-[#75675e]">
        {CLIENT_UNSUPPORTED_REPORT_FORMAT_CTA}
      </p>

      <div className="mx-auto mt-10 flex max-w-[520px] flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          type="button"
          className="rounded-full border border-[rgba(58,48,38,0.28)] bg-[rgba(255,255,255,0.45)] px-6 py-3 text-sm uppercase tracking-[0.12em] text-[#1e1a16] transition hover:border-[rgba(181,150,98,0.45)]"
          onClick={() => inputRef.current?.click()}
        >
          Upload Another Report
        </button>
        <Link
          href={conciergeHref}
          className={DI_V3_TEXT_CTA}
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:unsupported_report_format",
            )
          }
        >
          {CONSUMER_COPY.justinReviewCta} →
        </Link>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={DI_CLIENT_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </article>
  );
}
