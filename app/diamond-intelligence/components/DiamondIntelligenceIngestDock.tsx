"use client";

import { useCallback, useState } from "react";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import type { ListingExtraction } from "@/lib/diamond-intelligence/url-ingestion/types";
import { ReportUploadDock, type ClientUploadPhase } from "./ReportUploadDock";
import { CONSUMER_COPY } from "./consumer-display-labels";
import Link from "next/link";
import { buildConciergeHrefFromDiamondIntelligence } from "@/lib/concierge/diamond-intelligence-context";

export type IngestMode = "url" | "upload";

type DiamondIntelligenceIngestDockProps = {
  mode: IngestMode;
  onModeChange: (mode: IngestMode) => void;
  phase: ClientUploadPhase;
  disabled?: boolean;
  errorMessage?: string | null;
  statusNote?: string | null;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  onClearError?: () => void;
  metadata?: ClientSafeMetadata | null;
  fileName?: string | null;
  partialListing?: ListingExtraction | null;
  partialListingMessage?: string | null;
};

export function DiamondIntelligenceIngestDock({
  mode,
  onModeChange,
  phase,
  disabled,
  errorMessage,
  statusNote,
  onFile,
  onUrl,
  onClearError,
  metadata,
  fileName,
  partialListing,
  partialListingMessage,
}: DiamondIntelligenceIngestDockProps) {
  const [urlInput, setUrlInput] = useState("");
  const busy =
    phase === "reading" || phase === "checking" || phase === "building";

  const submitUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed || disabled) return;
    onClearError?.();
    onUrl(trimmed);
  }, [urlInput, disabled, onClearError, onUrl]);

  const conciergeHref = partialListing
    ? buildConciergeHrefFromDiamondIntelligence({
        lab: partialListing.lab ?? undefined,
        reportNumber: partialListing.reportNumber ?? undefined,
        carat: partialListing.carat?.toString(),
        shape: partialListing.shape ?? undefined,
      })
    : "/concierge";

  return (
    <div>
      <p className="mb-1 max-w-[52ch] font-serif text-[1.05rem] leading-snug text-[#1f1d1a] md:text-[1.12rem]">
        {CONSUMER_COPY.emptyStateIntro}
      </p>
      <p className="mb-5 max-w-[52ch] text-xs leading-relaxed text-[#75675e]">
        {CONSUMER_COPY.betaDisclosureShort}
      </p>

      <div className="mb-5 flex gap-1 rounded-xl border border-[rgba(181,150,98,0.18)] bg-[rgba(255,255,255,0.28)] p-1">
        <button
          type="button"
          onClick={() => onModeChange("url")}
          className={`flex-1 rounded-lg px-3 py-2.5 text-[10px] uppercase tracking-[0.22em] transition ${
            mode === "url"
              ? "bg-[#fbf7ef] text-[#1f1d1a] shadow-[0_1px_3px_rgba(30,26,22,0.06)] ring-1 ring-[rgba(181,150,98,0.28)]"
              : "text-[#948a80] hover:text-[#5f5851]"
          }`}
        >
          {CONSUMER_COPY.urlTabLabel}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("upload")}
          className={`flex-1 rounded-lg px-3 py-2.5 text-[10px] uppercase tracking-[0.22em] transition ${
            mode === "upload"
              ? "bg-[#fbf7ef] text-[#1f1d1a] shadow-[0_1px_3px_rgba(30,26,22,0.06)] ring-1 ring-[rgba(181,150,98,0.28)]"
              : "text-[#948a80] hover:text-[#5f5851]"
          }`}
        >
          {CONSUMER_COPY.uploadTabLabel}
        </button>
      </div>

      {mode === "url" ? (
        <div
          className={`rounded-xl border border-dashed px-4 py-4 text-left transition ${
            busy
              ? "border-[rgba(181,150,98,0.22)] bg-[rgba(251,247,239,0.55)] opacity-70"
              : "border-[rgba(181,150,98,0.28)] bg-[rgba(251,247,239,0.55)] hover:border-[rgba(181,150,98,0.42)]"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
            {CONSUMER_COPY.urlIngestHeadline}
          </p>
          <p className="mt-2 text-xs leading-snug text-[#5f5851]">
            {CONSUMER_COPY.urlIngestSubcopy}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              placeholder={CONSUMER_COPY.urlInputPlaceholder}
              value={urlInput}
              disabled={disabled || busy}
              onChange={(e) => {
                setUrlInput(e.target.value);
                onClearError?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitUrl();
                }
              }}
              className="min-w-0 flex-1 rounded border border-[#e4dbcf] bg-white/90 px-3 py-2 text-sm text-[#1f1d1a] placeholder:text-[#b8a99a] focus:border-[#a8926a] focus:outline-none focus:ring-1 focus:ring-[#e8dcc8]"
              aria-label="Diamond listing URL"
            />
            <button
              type="button"
              disabled={disabled || busy || !urlInput.trim()}
              onClick={submitUrl}
              className="shrink-0 rounded bg-[#2b2723] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {CONSUMER_COPY.urlIngestHelperLines.map((line) => (
              <p
                key={line}
                className="text-[10px] leading-snug text-[#948a80]"
              >
                {line}
              </p>
            ))}
          </div>

          {busy ? (
            <p className="mt-2 text-xs text-[#a8926a]">
              {phase === "reading"
                ? "Fetching listing details…"
                : phase === "checking"
                  ? "Looking for grading report…"
                  : "Building your interpretation…"}
            </p>
          ) : null}
        </div>
      ) : (
        <ReportUploadDock
          phase={phase}
          disabled={disabled}
          errorMessage={errorMessage}
          statusNote={statusNote}
          onFile={onFile}
          onClearError={onClearError}
          metadata={metadata}
          fileName={fileName}
        />
      )}

      {partialListing ? (
        <div className="mt-5 rounded-xl border border-[rgba(181,150,98,0.22)] bg-[rgba(251,247,239,0.72)] px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#a8926a]">
            {CONSUMER_COPY.partialListingHeadline}
          </p>
          <p className="mt-3 font-serif text-lg leading-snug text-[#1f1d1a]">
            {[
              partialListing.shape,
              partialListing.carat ? `${partialListing.carat} ct` : null,
              partialListing.color,
              partialListing.clarity,
              partialListing.cut,
            ]
              .filter(Boolean)
              .join(" · ") || "Details extracted from listing"}
          </p>
          {partialListing.price ? (
            <p className="mt-1.5 text-sm text-[#6f665d]">
              Listed at {partialListing.currency ?? "USD"}{" "}
              {partialListing.price.toLocaleString()}
            </p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-[#6f665d]">
            {CONSUMER_COPY.partialListingBody}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#948a80]">
            {CONSUMER_COPY.justinReviewCtaSupporting}
          </p>
          <Link
            href={conciergeHref}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-[rgba(58,48,38,0.18)] bg-white/80 px-5 py-2.5 text-[10px] uppercase tracking-[0.22em] text-[#2b2723] transition hover:bg-[#faf8f4]"
          >
            {CONSUMER_COPY.justinReviewCta}
          </Link>
        </div>
      ) : null}

      {mode === "url" && errorMessage && phase === "error" ? (
        <p className="mt-3 text-xs leading-relaxed text-[#6b5048]">
          {errorMessage}
        </p>
      ) : null}

      {mode === "url" && statusNote && phase !== "error" ? (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-[rgba(181,150,98,0.18)] bg-[rgba(251,247,239,0.55)] px-4 py-3">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a86a]"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-[#6f665d]">{statusNote}</p>
        </div>
      ) : null}

      <div className="mt-5 border-t border-[rgba(181,150,98,0.16)] pt-4 text-[10px] leading-relaxed text-[#9b8b78]">
        <p>{CONSUMER_COPY.betaDisclosure}</p>
        <p className="mt-2">
          {CONSUMER_COPY.betaDisclosureOutreach}{" "}
          <a
            href="mailto:Justin@HourglassDiamonds.com"
            className="text-[#8b735b] underline decoration-[rgba(181,150,98,0.4)] underline-offset-[3px] transition-colors hover:text-[#5f5851]"
          >
            {CONSUMER_COPY.betaDisclosureEmail}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
