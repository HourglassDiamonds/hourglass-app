"use client";

import Link from "next/link";
import { useRef } from "react";
import { DI_CLIENT_ACCEPT } from "@/lib/diamond-intelligence/upload-validation";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import {
  CONSUMER_COPY,
  V3_UNABLE_TO_VERIFY,
} from "./consumer-display-labels";
import {
  DI_V3_BRAND,
  DI_V3_PARTIAL_CARD,
  DI_V3_PRODUCT,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export default function DiV3UnableToVerify({
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
        {V3_UNABLE_TO_VERIFY.eyebrow}
      </p>

      <h1 className="mt-4 font-serif text-[clamp(34px,5.5vw,52px)] font-normal uppercase leading-[0.98] tracking-[0.035em] text-[#1e1a16]">
        {V3_UNABLE_TO_VERIFY.headline}
      </h1>

      <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.72] text-[#6f665b]">
        {V3_UNABLE_TO_VERIFY.body}
      </p>

      <p className="mx-auto mt-8 max-w-[520px] text-[11px] uppercase tracking-[0.14em] text-[#9b8b78]">
        Potential reasons
      </p>
      <ul className="mx-auto mt-4 max-w-[520px] grid list-none gap-3 p-0 text-left text-[15px] text-[#514536]">
        {V3_UNABLE_TO_VERIFY.reasons.map((item) => (
          <li key={item} className="relative pl-6">
            <span className="absolute left-0 text-[#b59662]">•</span>
            {item}
          </li>
        ))}
      </ul>

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
              "diamond_intelligence:unable_to_verify",
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
