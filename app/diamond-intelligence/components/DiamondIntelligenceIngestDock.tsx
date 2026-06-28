"use client";

import Link from "next/link";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import type { DiamondIntelligenceUploadErrorKind } from "@/lib/diamond-intelligence/upload-format-policy";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { ReportUploadDock, type ClientUploadPhase } from "./ReportUploadDock";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { DI_EYEBROW_STUDIO } from "./di-studio-styles";

type DiamondIntelligenceIngestDockProps = {
  phase: ClientUploadPhase;
  disabled?: boolean;
  errorMessage?: string | null;
  uploadErrorKind?: DiamondIntelligenceUploadErrorKind | null;
  statusNote?: string | null;
  onFile: (file: File) => void;
  onClearError?: () => void;
  metadata?: ClientSafeMetadata | null;
  fileName?: string | null;
};

export function DiamondIntelligenceIngestDock({
  phase,
  disabled,
  errorMessage,
  uploadErrorKind,
  statusNote,
  onFile,
  onClearError,
  metadata,
  fileName,
}: DiamondIntelligenceIngestDockProps) {
  return (
    <div>
      <p className={`${DI_EYEBROW_STUDIO} mb-3`}>
        {CONSUMER_COPY.ingestSectionHeadline}
      </p>
      <p className="mb-6 max-w-[52ch] text-xs leading-relaxed text-[#75675e]">
        {CONSUMER_COPY.ingestSectionSupportingCopy}
      </p>

      <ReportUploadDock
        phase={phase}
        disabled={disabled}
        errorMessage={errorMessage}
        uploadErrorKind={uploadErrorKind}
        statusNote={statusNote}
        onFile={onFile}
        onClearError={onClearError}
        metadata={metadata}
        fileName={fileName}
      />

      <p className="mt-5 max-w-[52ch] text-[10px] leading-relaxed text-[#a89888]">
        {CONSUMER_COPY.listingLinkConciergePrefix}{" "}
        <Link
          href="/concierge"
          className="text-[#948a80] underline decoration-[rgba(181,150,98,0.32)] underline-offset-[3px] transition-colors hover:text-[#75675e]"
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:listing_link_fallback",
            )
          }
        >
          {CONSUMER_COPY.listingLinkConciergeCta}
        </Link>{" "}
        {CONSUMER_COPY.listingLinkConciergeSuffix}
      </p>

      <div className="mt-5 border-t border-[rgba(181,150,98,0.16)] pt-4 text-[10px] leading-relaxed text-[#9b8b78]">
        <p>{CONSUMER_COPY.betaDisclosure}</p>
        <p className="mt-2">
          {CONSUMER_COPY.betaDisclosureOutreachPrefix}{" "}
          <Link
            href="/concierge"
            className="text-[#8b735b] underline decoration-[rgba(181,150,98,0.4)] underline-offset-[3px] transition-colors hover:text-[#5f5851]"
          >
            {CONSUMER_COPY.betaDisclosureConciergeLinkLabel}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
