"use client";

import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import type { DiamondIntelligenceUploadErrorKind } from "@/lib/diamond-intelligence/upload-format-policy";
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

      <p className="mt-5 max-w-[52ch] text-[10px] leading-relaxed text-[#756a5f]">
        {CONSUMER_COPY.listingLinkConciergePrefix}{" "}
        <ConsultationCtaLink
          location="diamond_intelligence:listing_fallback"
          tool="diamond-intelligence"
          className="text-[#6d655e] underline decoration-[rgba(181,150,98,0.32)] underline-offset-[3px] transition-colors hover:text-[#75675e]"
        >
          {CONSUMER_COPY.listingLinkConciergeCta}
        </ConsultationCtaLink>{" "}
        {CONSUMER_COPY.listingLinkConciergeSuffix}
      </p>

      <div className="mt-5 border-t border-[rgba(181,150,98,0.16)] pt-4 text-[10px] leading-relaxed text-[#766a58]">
        <p>{CONSUMER_COPY.betaDisclosure}</p>
        <p className="mt-2">
          {CONSUMER_COPY.betaDisclosureOutreachPrefix}{" "}
          <ConsultationCtaLink
            location="diamond_intelligence:beta_disclosure"
            tool="diamond-intelligence"
            className="text-[#75603f] underline decoration-[rgba(181,150,98,0.4)] underline-offset-[3px] transition-colors hover:text-[#5f5851]"
          >
            {CONSUMER_COPY.betaDisclosureConciergeLinkLabel}
          </ConsultationCtaLink>
          .
        </p>
      </div>
    </div>
  );
}