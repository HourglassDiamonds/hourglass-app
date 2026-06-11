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
      <div className="mb-4 flex gap-2 border-b border-[#e4dbcf]/80">
        <button
          type="button"
          onClick={() => onModeChange("url")}
          className={`border-b-2 px-1 pb-2 text-[10px] uppercase tracking-[0.24em] transition ${
            mode === "url"
              ? "border-[#a8926a] text-[#1f1d1a]"
              : "border-transparent text-[#948a80] hover:text-[#5f5851]"
          }`}
        >
          {CONSUMER_COPY.urlTabLabel}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("upload")}
          className={`border-b-2 px-1 pb-2 text-[10px] uppercase tracking-[0.24em] transition ${
            mode === "upload"
              ? "border-[#a8926a] text-[#1f1d1a]"
              : "border-transparent text-[#948a80] hover:text-[#5f5851]"
          }`}
        >
          {CONSUMER_COPY.uploadTabLabel}
        </button>
      </div>

      {mode === "url" ? (
        <div
          className={`rounded-md border border-dashed px-3 py-3.5 text-left transition ${
            busy
              ? "border-[#e4dbcf] bg-[#faf8f4]/80 opacity-70"
              : "border-[#e4dbcf] bg-[#faf8f4]/80 hover:border-[#cbbda9]"
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
              placeholder="https://www.jamesallen.com/..."
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
        <div className="mt-4 rounded-md border border-[#e4dbcf]/80 bg-[#faf8f4]/90 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#948a80]">
            Listing details
          </p>
          <p className="mt-2 font-serif text-lg text-[#1f1d1a]">
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
            <p className="mt-1 text-sm text-[#6f665d]">
              Listed at {partialListing.currency ?? "USD"}{" "}
              {partialListing.price.toLocaleString()}
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-[#6f665d]">
            {partialListingMessage ?? CONSUMER_COPY.partialListingBody}
          </p>
          <Link
            href={conciergeHref}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-[#cbbda9] bg-white px-5 py-2.5 text-[10px] uppercase tracking-[0.22em] text-[#2b2723] transition hover:bg-[#faf8f4]"
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
        <div className="mt-3 flex gap-2.5 rounded-md border border-[#e4dbcf]/70 bg-[#faf8f4]/80 px-3 py-2.5">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a86a]"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-[#6f665d]">{statusNote}</p>
        </div>
      ) : null}
    </div>
  );
}
