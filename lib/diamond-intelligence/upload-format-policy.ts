/** Consumer copy for pre-extraction upload rejections (unsupported format). */
export const DI_UNSUPPORTED_FILE_TYPE_MESSAGE =
  "This file type isn't supported yet. Please upload a PDF, JPG, or PNG image of the report.";

/** Validation codes that mean the file never reached extraction. */
export const UNSUPPORTED_UPLOAD_VALIDATION_CODES = new Set([
  "blocked_extension",
  "unsupported_extension",
  "unsupported_mime",
  "unknown_binary",
  "mime_content_mismatch",
]);

export function isUnsupportedUploadValidationCode(
  code: string | undefined | null,
): boolean {
  return Boolean(code && UNSUPPORTED_UPLOAD_VALIDATION_CODES.has(code));
}

export type DiamondIntelligenceUploadErrorKind =
  | "unsupported_format"
  | "interpret_failure";
