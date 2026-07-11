"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import {
  DI_CLIENT_ACCEPT,
  isPublicDiamondIntelligencePdfUpload,
} from "@/lib/diamond-intelligence/upload-accept";
import type { DiamondIntelligenceUploadErrorKind } from "@/lib/diamond-intelligence/upload-format-policy";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";
import { CONSUMER_COPY } from "./consumer-display-labels";

export type ClientUploadPhase =
  | "idle"
  | "reading"
  | "checking"
  | "building"
  | "error";

type ReportUploadDockProps = {
  phase: ClientUploadPhase;
  disabled?: boolean;
  errorMessage?: string | null;
  uploadErrorKind?: DiamondIntelligenceUploadErrorKind | null;
  statusNote?: string | null;
  onFile: (file: File) => void;
  /** Clears any prior upload error the moment new activity begins. */
  onClearError?: () => void;
  metadata?: ClientSafeMetadata | null;
  fileName?: string | null;
};

/**
 * Always-on upload dock: tap the overlay input on mobile, click or drop on desktop.
 */
export function ReportUploadDock({
  phase,
  disabled,
  errorMessage,
  uploadErrorKind,
  statusNote,
  onFile,
  onClearError,
  metadata,
  fileName,
}: ReportUploadDockProps) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [localPdfRejection, setLocalPdfRejection] = useState(false);
  const busy =
    phase === "reading" || phase === "checking" || phase === "building";
  const uploadDisabled = Boolean(disabled || busy);
  const hasReport = Boolean(metadata);
  const showServerError = phase === "error" && Boolean(errorMessage);
  const showPdfOnlyRejection =
    localPdfRejection ||
    (showServerError && uploadErrorKind === "unsupported_format");

  const clearPdfRejection = useCallback(() => {
    setLocalPdfRejection(false);
    onClearError?.();
  }, [onClearError]);

  const pick = useCallback(
    (f: File | null | undefined) => {
      if (!f || uploadDisabled) return;
      if (!isPublicDiamondIntelligencePdfUpload(f)) {
        setLocalPdfRejection(true);
        return;
      }
      setLocalPdfRejection(false);
      onFile(f);
    },
    [uploadDisabled, onFile],
  );

  const statusLine = busy ? "Review in progress" : null;

  return (
    <div>
      <div
        className={`relative rounded-xl border border-dashed px-4 py-4 text-left transition ${
          dragOver
            ? "border-[rgba(181,150,98,0.42)] bg-[rgba(251,247,239,0.72)] ring-1 ring-[rgba(181,150,98,0.18)]"
            : "border-[rgba(181,150,98,0.28)] bg-[rgba(251,247,239,0.55)]"
        } ${uploadDisabled ? "opacity-60" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!uploadDisabled) {
            setDragOver(true);
            clearPdfRejection();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!uploadDisabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          const related = e.relatedTarget as Node | null;
          if (related && e.currentTarget.contains(related)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        {hasReport && metadata ? (
          <div
            className={`relative z-0 flex items-start gap-3 pointer-events-none ${
              busy ? "opacity-70" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#e4dbcf] bg-white/80 text-[#b8a99a]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-[#1f1d1a]">
                  {metadata.lab} report
                </p>
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e8efe6] text-[#4a6b44]"
                  aria-hidden
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-[#847a70]">
                {fileName || metadata.reportNumber}
              </p>
            </div>
          </div>
        ) : (
          <p className="pointer-events-none relative z-0 text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
            Upload report PDF
          </p>
        )}

        <p
          className={`pointer-events-none relative z-0 text-xs leading-snug text-[#5f5851] ${
            hasReport && !busy ? "mt-3" : "mt-2"
          }`}
        >
          {statusLine ??
            (hasReport
              ? "Drop a new PDF here to replace"
              : "Drop the original grading report PDF here")}
        </p>

        {!busy && !hasReport ? (
          <div className="pointer-events-none relative z-0 mt-2 space-y-1">
            {CONSUMER_COPY.uploadHelperLines.map((line) => (
              <p
                key={line}
                className="text-[10px] leading-snug text-[#948a80]"
              >
                {line === CONSUMER_COPY.uploadHelperLines[0] ? (
                  <strong className="font-semibold">{line}</strong>
                ) : (
                  line
                )}
              </p>
            ))}
          </div>
        ) : !busy ? (
          <p className="pointer-events-none relative z-0 mt-2 text-[10px] leading-snug text-[#948a80]">
            Or click to browse · PDF only
          </p>
        ) : null}

        {!uploadDisabled ? (
          <input
            id={inputId}
            type="file"
            accept={DI_CLIENT_ACCEPT}
            aria-label="Upload original grading report PDF"
            className={`absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 ${
              dragOver ? "pointer-events-none" : ""
            }`}
            onChange={(e) => {
              clearPdfRejection();
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        ) : null}
      </div>

      {!busy ? (
        <div className="mt-3 max-w-[52ch] space-y-2">
          <p className="text-[10px] leading-relaxed text-[#a89888]">
            {CONSUMER_COPY.uploadBestPracticeLine}
          </p>
          <p className="hidden text-[10px] leading-relaxed text-[#a89888] md:block">
            {CONSUMER_COPY.uploadDesktopHelperLine}
          </p>
          <p className="text-[10px] leading-relaxed text-[#a89888] md:hidden">
            {CONSUMER_COPY.uploadMobileHelperLine}
          </p>
        </div>
      ) : null}

      {statusNote && !showServerError && !showPdfOnlyRejection ? (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-[rgba(181,150,98,0.18)] bg-[rgba(251,247,239,0.55)] px-4 py-3">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a86a]"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-[#6f665d]">{statusNote}</p>
        </div>
      ) : null}
      {showPdfOnlyRejection ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-[#6b5048]">
            {localPdfRejection
              ? CONSUMER_COPY.pdfOnlyRejectionPrimary
              : errorMessage}
          </p>
          <p className="text-xs leading-relaxed text-[#75675e]">
            {CONSUMER_COPY.pdfOnlyRejectionSecondary}{" "}
            <Link
              href="/concierge"
              className="text-[#948a80] underline decoration-[rgba(181,150,98,0.32)] underline-offset-[3px] transition-colors hover:text-[#75675e]"
            >
              Concierge
            </Link>
            .
          </p>
        </div>
      ) : showServerError ? (
        <p className="mt-3 text-xs leading-relaxed text-[#6b5048]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
