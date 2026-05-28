import type { CalibrationLab } from "./types";

export type UploadPipelinePhase =
  | "file-read"
  | "pdf-open"
  | "pdf-text-layer"
  | "pdf-full-page-ocr"
  | "image-render"
  | "ocr-full-page"
  | "ocr-region-crops"
  | "text-parse"
  | "parser-finalizer"
  | "client-payload";

export type UploadPipelineTimingRecord = {
  phase: UploadPipelinePhase;
  durationMs: number;
  labFamily?: string;
  parserPath?: string;
  detail?: string;
};

const isDevTiming =
  process.env.NODE_ENV === "development" ||
  process.env.CALIBRATION_UPLOAD_TIMING === "1";

/** Dev-only structured timing logs — no document text or field values. */
export function logUploadPipelineTiming(
  record: UploadPipelineTimingRecord,
): void {
  if (!isDevTiming) return;
  const label = record.labFamily
    ? `${record.labFamily}/${record.phase}`
    : record.phase;
  console.log("[upload-timing]", {
    label,
    ms: record.durationMs,
    parser: record.parserPath,
    detail: record.detail,
  });
}

export function labFamilyLabel(
  lab: CalibrationLab | string | undefined,
  parserType?: string,
): string {
  if (parserType === "gcal-8x") return "GCAL-8X";
  if (parserType === "gcal-sarine-4cs") return "GCAL-Sarine";
  if (lab === "GCAL") return "GCAL";
  if (lab === "GIA") return "GIA";
  if (lab === "IGI") return "IGI";
  if (lab === "AGS") return "AGS";
  return lab?.trim() || "unknown";
}
