import type { ReportSource } from "./types";

export function inferReportSourceFromUpload(
  mimeType: string | undefined,
  hasPastedText: boolean,
): ReportSource {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("pdf")) return "pdf-upload";
  if (mime.startsWith("image/")) return "screenshot-upload";
  return hasPastedText ? "manual" : "manual";
}
