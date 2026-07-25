/**
 * Safe diagnostic logging for Diamond Intelligence / calibration extract paths.
 * Never logs report numbers, OCR/PDF text, filenames, base64, secrets, or field values.
 */

export type SafeDiagnosticFields = {
  laboratory?: string | null;
  parserPathUsed?: string | null;
  parserFamily?: string | null;
  parserType?: string | null;
  stage?: string | null;
  phase?: string | null;
  status?: string | null;
  reason?: string | null;
  triggered?: boolean | null;
  timedOut?: boolean | null;
  durationMs?: number | null;
  elapsedMs?: number | null;
  pageCount?: number | null;
  pageIndex?: number | null;
  pageWidth?: number | null;
  pageHeight?: number | null;
  renderScale?: number | null;
  cropWidth?: number | null;
  cropHeight?: number | null;
  imageNonBlank?: boolean | null;
  cropSucceeded?: boolean | null;
  pageRendered?: boolean | null;
  ocrOk?: boolean | null;
  ocrTokenCount?: number | null;
  ocrCharCount?: number | null;
  ocrTransport?: string | null;
  ocrRuntimeAvailable?: boolean | null;
  assignedFieldKeys?: readonly string[] | null;
  missingFieldKeys?: readonly string[] | null;
  populatedFieldKeys?: readonly string[] | null;
  recoveredFieldKeys?: readonly string[] | null;
  candidateFieldKeys?: readonly string[] | null;
  rejectedCandidateCount?: number | null;
  warningCount?: number | null;
  noticeCount?: number | null;
  scoreEligible?: boolean | null;
  errorCategory?: string | null;
  errorClass?: string | null;
  failureMode?: string | null;
  httpStatus?: number | null;
  cropAttempted?: boolean | null;
  cropGatePassed?: boolean | null;
  ocrPathExecuted?: boolean | null;
  textLen?: number | null;
  method?: string | null;
  eligible?: boolean | null;
  excluded?: boolean | null;
};

const ALLOWED_KEYS = new Set<keyof SafeDiagnosticFields>([
  "laboratory",
  "parserPathUsed",
  "parserFamily",
  "parserType",
  "stage",
  "phase",
  "status",
  "reason",
  "triggered",
  "timedOut",
  "durationMs",
  "elapsedMs",
  "pageCount",
  "pageIndex",
  "pageWidth",
  "pageHeight",
  "renderScale",
  "cropWidth",
  "cropHeight",
  "imageNonBlank",
  "cropSucceeded",
  "pageRendered",
  "ocrOk",
  "ocrTokenCount",
  "ocrCharCount",
  "ocrTransport",
  "ocrRuntimeAvailable",
  "assignedFieldKeys",
  "missingFieldKeys",
  "populatedFieldKeys",
  "recoveredFieldKeys",
  "candidateFieldKeys",
  "rejectedCandidateCount",
  "warningCount",
  "noticeCount",
  "scoreEligible",
  "errorCategory",
  "errorClass",
  "failureMode",
  "httpStatus",
  "cropAttempted",
  "cropGatePassed",
  "ocrPathExecuted",
  "textLen",
  "method",
  "eligible",
  "excluded",
]);

export function populatedFieldKeysFromRecord(
  fields: Record<string, string | undefined | null> | null | undefined,
): string[] {
  if (!fields) return [];
  return Object.entries(fields)
    .filter(([, v]) => Boolean(String(v ?? "").trim()))
    .map(([k]) => k)
    .sort();
}

export function sanitizeSafeDiagnostic(
  meta: SafeDiagnosticFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!ALLOWED_KEYS.has(key as keyof SafeDiagnosticFields)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export function logSafeDiagnostic(
  tag: string,
  meta: SafeDiagnosticFields,
): void {
  try {
    console.log(tag, sanitizeSafeDiagnostic(meta));
  } catch {
    // Diagnostics must never affect extract/interpret outcomes.
  }
}

/** Text-only helper: assert console payloads never contain known secrets/PII. */
export const PRIVACY_FORBIDDEN_SUBSTRINGS = [
  "2548574094",
  "2517213965",
  "LG360796247",
  "360796247",
  "OCR_WORKER_SECRET",
  "Bearer test-secret",
  "Bearer ",
  "iVBORw0KGgo",
  "data:image",
] as const;
