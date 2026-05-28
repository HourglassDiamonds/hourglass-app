/**
 * GCAL report-family detection — router-owned; parsers must not self-route.
 */

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
  return (
    /\bGCAL\s+BY\s+SARINE\b/i.test(t) &&
    /certificate\s+no/i.test(t) &&
    /4C'?s?\s+GRADING/i.test(t)
  );
}
