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
  CONSUMER_COPY,
  V3_UNABLE_TO_VERIFY,
  V3_UNABLE_TO_VERIFY_IMAGE,
} from "./consumer-display-labels";
import {
  DI_V3_BRAND,
  DI_V3_PARTIAL_CARD,
  DI_V3_PRODUCT,
  DI_V3_STATE_EYEBROW,
  DI_V3_STATE_TITLE,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export default function DiV3UnableToVerify({
  onFile,
  reportContext,
  difficultImageRead = false,
}: {
  onFile: (file: File) => void;
  reportContext?: DiamondIntelligenceConciergeContext;
  difficultImageRead?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );
  const copy = difficultImageRead ? V3_UNABLE_TO_VERIFY_IMAGE : V3_UNABLE_TO_VERIFY;
  const trackingSource = difficultImageRead
    ? "diamond_intelligence:unable_to_verify_image"
    : "diamond_intelligence:unable_to_verify";

  return (
    <article className={DI_V3_PARTIAL_CARD}>
      <div className="mb-8">
        <div className={DI_V3_BRAND}>Hourglass Diamonds</div>
        <div className={`${DI_V3_PRODUCT} mt-3.5`}>Diamond Intelligence</div>
      </div>

      <p className={DI_V3_STATE_EYEBROW}>{copy.eyebrow}</p>

      <h1 className={DI_V3_STATE_TITLE}>{copy.headline}</h1>

      <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-[1.72] text-[#6f665b]">
        {copy.body}
      </p>

      {difficultImageRead ? (
        <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.72] text-[#75675e]">
          {V3_UNABLE_TO_VERIFY_IMAGE.followUp}
        </p>
      ) : (
        <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.72] text-[#75675e]">
          {V3_UNABLE_TO_VERIFY.reassurance}
        </p>
      )}

      {!difficultImageRead ? (
        <>
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
        </>
      ) : null}

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
          onClick={() => trackConsultationCtaClicked(trackingSource)}
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
