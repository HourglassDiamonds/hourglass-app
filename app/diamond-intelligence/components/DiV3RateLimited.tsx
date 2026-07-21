"use client";

import Link from "next/link";
import { useRef } from "react";
import { DI_CLIENT_ACCEPT } from "@/lib/diamond-intelligence/upload-accept";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CONSUMER_COPY, V3_RATE_LIMITED } from "./consumer-display-labels";
import {
  DI_V3_BRAND,
  DI_V3_PARTIAL_CARD,
  DI_V3_PRODUCT,
  DI_V3_STATE_EYEBROW,
  DI_V3_STATE_TITLE,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export default function DiV3RateLimited({
  onFile,
  reportContext,
  retryAfterSeconds,
}: {
  onFile: (file: File) => void;
  reportContext?: DiamondIntelligenceConciergeContext;
  retryAfterSeconds?: number | null;
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

      <p className={DI_V3_STATE_EYEBROW}>{V3_RATE_LIMITED.eyebrow}</p>

      <h1 className={DI_V3_STATE_TITLE}>{V3_RATE_LIMITED.headline}</h1>

      <div className="mx-auto mt-6 max-w-[520px] space-y-4">
        {V3_RATE_LIMITED.bodyParagraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="text-[17px] leading-[1.72] text-[#6f665b]"
          >
            {paragraph}
          </p>
        ))}
      </div>

      {retryAfterSeconds != null && retryAfterSeconds > 0 ? (
        <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.72] text-[#75675e]">
          {V3_RATE_LIMITED.retryAfterLine(retryAfterSeconds)}
        </p>
      ) : null}

      <div className="mx-auto mt-10 flex max-w-[520px] flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          type="button"
          className="rounded-full border border-[rgba(58,48,38,0.28)] bg-[rgba(255,255,255,0.45)] px-6 py-3 text-sm uppercase tracking-[0.12em] text-[#1e1a16] transition hover:border-[rgba(181,150,98,0.45)]"
          onClick={() => inputRef.current?.click()}
        >
          {V3_RATE_LIMITED.tryAgainCta}
        </button>
        <Link
          href={conciergeHref}
          className={DI_V3_TEXT_CTA}
          onClick={() =>
            trackConsultationCtaClicked("diamond_intelligence:rate_limited")
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
