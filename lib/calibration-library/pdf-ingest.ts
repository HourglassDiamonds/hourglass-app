/** Legacy client PDF fallback (browser-only extract). */
export const PDF_IMAGE_FALLBACK_COPY =
  "This PDF appears image-based or protected. Paste the report details below, or upload a screenshot in the next version.";

export const OCR_UNAVAILABLE_COPY =
  "OCR is not available in this environment. Paste the report details below to continue.";

export const PDF_NEEDS_PASTE_COPY =
  "Paste the report details below if automatic extraction did not capture everything.";

/** Minimum non-whitespace characters to treat PDF text extraction as usable. */
export const MIN_USABLE_PDF_TEXT_CHARS = 48;

export type PdfTextExtractResult = {
  text: string;
  sufficient: boolean;
  error?: string;
};
