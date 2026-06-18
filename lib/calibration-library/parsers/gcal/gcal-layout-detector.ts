/**
 * GCAL report-family detection — router-owned; parsers must not self-route.
 */

/** HEADER_TINY image-only PDF probe — GCAL certificate line without full-page OCR. */
export function looksLikeGcal8xCertificateProbeText(text: string): boolean {
  return /\bGCAL\s+LG?\d{6,12}\b/i.test(text.slice(0, 2000));
}

export function looksLikeGcal8xReportText(text: string): boolean {
  const t = text.slice(0, 14000);
  if (/\bGCAL\s*8\s*X\b/i.test(t)) return true;
  if (/\bGCAL\b/i.test(t) && /\b8\s*X\b/i.test(t)) return true;
  if (
    /\bGCAL\b/i.test(t) &&
    /\b(?:gem\s+certification\s*&\s*assurance|ultimate\s+diamond)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function looksLikeGcalSarine4csReportText(text: string): boolean {
  const t = text.slice(0, 20000);
  if (!/\bGCAL\b/i.test(t)) return false;

  const sarineMarker =
    /\bGCAL\s+BY\s+SARINE\b/i.test(t) ||
    /\bGCAL\s+by\s+Sarine\b/i.test(t) ||
    (/\bBY\s+SARINE\b/i.test(t) && /\bGCAL\b/i.test(t)) ||
    /\bgcalusa\.com\/c\//i.test(t);

  if (!sarineMarker) return false;

  const certMarker =
    /certificate\s+(?:no|number)/i.test(t) ||
    /\bGCAL\s+LG?\d{6,12}\b/i.test(t);

  const gradingMarker =
    /4C'?s?\s+GRAD/i.test(t) ||
    /\b4C'?s?\s+Color\s+[D-Z]\b/i.test(t) ||
    /(?:color|colour)\s+grading\s+scale/i.test(t) ||
    /\bGCAL\s+LG?\d{6,12}\s+RB\s+[\d.]+\s+[D-Z]\s+/i.test(t);

  return certMarker && (gradingMarker || /\bgcalusa\.com\/c\//i.test(t));
}
