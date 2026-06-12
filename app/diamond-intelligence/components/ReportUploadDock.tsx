"use client";

import { useCallback, useRef, useState } from "react";
import { DI_CLIENT_ACCEPT } from "@/lib/diamond-intelligence/upload-accept";
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
  statusNote?: string | null;
  onFile: (file: File) => void;
  /** Clears any prior upload error the moment new activity begins. */
  onClearError?: () => void;
  metadata?: ClientSafeMetadata | null;
  fileName?: string | null;
};

/**
 * Always-on upload dock: click or drop anywhere on the card to upload or replace.
 */
export function ReportUploadDock({
  phase,
  disabled,
  errorMessage,
  statusNote,
  onFile,
  onClearError,
  metadata,
  fileName,
}: ReportUploadDockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const busy =
    phase === "reading" || phase === "checking" || phase === "building";
  const hasReport = Boolean(metadata);
  // Only the current attempt's failure shows error copy — never a stale one.
  const showError = phase === "error" && Boolean(errorMessage);

  const pick = useCallback(
    (f: File | null | undefined) => {
      if (!f || disabled) return;
      onFile(f);
    },
    [disabled, onFile],
  );

  const statusLine =
    phase === "reading"
      ? "Reading the report…"
      : phase === "checking"
        ? "Checking proportion details…"
        : phase === "building"
          ? "Building your interpretation…"
          : null;

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={
          hasReport
            ? "Drop a new lab report here to replace the current report, or click to browse"
            : "Upload a lab report by dropping a file here or clicking to browse"
        }
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            setDragOver(true);
            onClearError?.();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragOver(true);
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
        onClick={() => !disabled && inputRef.current?.click()}
        className={`rounded-xl border border-dashed px-4 py-4 text-left transition ${
          dragOver
            ? "border-[rgba(181,150,98,0.42)] bg-[rgba(251,247,239,0.72)] ring-1 ring-[rgba(181,150,98,0.18)]"
            : "border-[rgba(181,150,98,0.28)] bg-[rgba(251,247,239,0.55)]"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[rgba(181,150,98,0.42)]"}`}
      >
        {hasReport && metadata ? (
          <div
            className={`flex items-start gap-3 pointer-events-none ${
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
          <p className="pointer-events-none text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
            Upload report
          </p>
        )}

        <p
          className={`pointer-events-none text-xs leading-snug text-[#5f5851] ${
            hasReport && !busy ? "mt-3" : "mt-2"
          }`}
        >
          {statusLine ??
            (hasReport
              ? "Drop a new report here to replace"
              : "Drop a lab report here")}
        </p>

        {!busy && !hasReport ? (
          <div className="pointer-events-none mt-2 space-y-1">
            {CONSUMER_COPY.uploadHelperLines.map((line) => (
              <p
                key={line}
                className="text-[10px] leading-snug text-[#948a80]"
              >
                {line}
              </p>
            ))}
          </div>
        ) : !busy ? (
          <p className="pointer-events-none mt-2 text-[10px] leading-snug text-[#948a80]">
            Or click to browse · GIA, IGI, or GCAL 8X PDF
          </p>
        ) : (
          <p className="pointer-events-none mt-1.5 text-[10px] text-[#a8926a]">
            Please wait
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={DI_CLIENT_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {statusNote && !showError ? (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-[rgba(181,150,98,0.18)] bg-[rgba(251,247,239,0.55)] px-4 py-3">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a86a]"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-[#6f665d]">{statusNote}</p>
        </div>
      ) : null}
      {showError ? (
        <p className="mt-3 text-xs leading-relaxed text-[#6b5048]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
