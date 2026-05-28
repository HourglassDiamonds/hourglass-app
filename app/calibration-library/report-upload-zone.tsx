"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_REPORT_EXTENSIONS } from "@/lib/calibration-library/accepted-files";

export type ExtractionStatus =
  | "idle"
  | "uploading"
  | "pdf-text"
  | "ocr"
  | "parsing"
  | "ready"
  | "error";

const STATUS_LABEL: Record<ExtractionStatus, string> = {
  idle: "Drop a report or click to browse",
  uploading: "Uploading…",
  "pdf-text": "Reading PDF text…",
  ocr: "Running OCR…",
  parsing: "Parsing report fields…",
  ready: "Extraction complete — review below",
  error: "Extraction needs attention",
};

type Props = {
  file: File | null;
  status: ExtractionStatus;
  disabled?: boolean;
  onFile: (file: File) => void;
  className?: string;
};

export default function ReportUploadZone({
  file,
  status,
  disabled,
  onFile,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = useCallback(
    (f: File | null | undefined) => {
      if (!f || disabled) return;
      onFile(f);
    },
    [disabled, onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      pick(f);
    },
    [pick],
  );

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-sm border border-dashed px-6 py-12 text-center transition ${
          dragOver
            ? "border-[#1f1d1a]/35 bg-white/55"
            : "border-[#e4dbcf]/90 bg-white/25 hover:border-[#c4b8a8] hover:bg-white/40"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <p className="font-serif text-lg text-[#1f1c19]">
          {dragOver ? "Release to upload" : "Drop report here"}
        </p>
        <p className="mt-2 text-xs text-[#847a70]">
          PDF, JPG, PNG, JPEG, WEBP — or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_REPORT_EXTENSIONS}
          disabled={disabled}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {file ? (
        <div className="mt-4 rounded-sm border border-[#e4dbcf]/62 bg-white/35 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
            Selected file
          </p>
          <p className="mt-1 truncate font-mono text-sm text-[#1f1d1a]">{file.name}</p>
          <p
            className={`mt-2 text-sm ${
              status === "error" ? "text-[#8a4a3a]" : "text-[#5f5851]"
            }`}
          >
            {STATUS_LABEL[status]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
