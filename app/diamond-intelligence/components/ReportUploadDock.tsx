"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_REPORT_EXTENSIONS } from "@/lib/calibration-library/accepted-files";
import type { ClientSafeMetadata } from "@/lib/diamond-intelligence";

export type ClientUploadPhase =
  | "idle"
  | "reading"
  | "checking"
  | "building";

type ReportUploadDockProps = {
  phase: ClientUploadPhase;
  disabled?: boolean;
  errorMessage?: string | null;
  statusNote?: string | null;
  onFile: (file: File) => void;
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
  metadata,
  fileName,
}: ReportUploadDockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const busy = phase !== "idle";
  const hasReport = Boolean(metadata);

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
          if (!disabled) setDragOver(true);
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
        className={`rounded-md border border-dashed px-3 py-3.5 text-left transition ${
          dragOver
            ? "border-[#a8926a] bg-[#faf8f4] ring-1 ring-[#e8dcc8]/80"
            : "border-[#e4dbcf] bg-[#faf8f4]/80"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#cbbda9]"}`}
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

        {!busy ? (
          <p className="pointer-events-none mt-1.5 text-[10px] leading-snug text-[#948a80]">
            {hasReport
              ? "Or click to browse · PDF or image from GIA, IGI, GCAL"
              : "PDF or image from GIA, IGI, GCAL"}
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
        accept={ACCEPTED_REPORT_EXTENSIONS}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {statusNote && !errorMessage ? (
        <div className="mt-3 flex gap-2.5 rounded-md border border-[#e4dbcf]/70 bg-[#faf8f4]/80 px-3 py-2.5">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a86a]"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-[#6f665d]">{statusNote}</p>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-xs leading-relaxed text-[#6b5048]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
