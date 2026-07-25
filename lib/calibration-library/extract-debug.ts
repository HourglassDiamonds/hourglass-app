import type { CalibrationReportFields, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Fields logged during calibration extract pipeline debug. */
export const EXTRACT_PIPELINE_FIELD_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

/** @deprecated Use EXTRACT_PIPELINE_FIELD_KEYS */
export const IGI_PROPORTION_FIELD_KEYS: ReportFieldKey[] = [
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
];

export function shouldLogExtractPipeline(
  text: string,
  reportNumberHint?: string,
): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  const probe = `${text}\n${reportNumberHint ?? ""}`;
  return (
    /\bLG773657228\b/i.test(probe) ||
    /\b2527039693\b/.test(probe)
  );
}

export function snapshotProportionFields(
  fields: CalibrationReportFields,
): Record<string, string> {
  return Object.fromEntries(
    EXTRACT_PIPELINE_FIELD_KEYS.map((k) => [k, fields[k] ?? ""]),
  );
}

export function logExtractPipeline(
  step: string,
  payload: Record<string, unknown>,
): void {
  console.log(
    `[calibration-extract] ${step}`,
    JSON.stringify({ keys: Object.keys(payload) }, null, 2),
  );
}

/** Forensic hydration tracing (CALIBRATION_EXTRACT_DEBUG=1 or report 2527039693). */
export function shouldLogForensicHydration(
  textOrReportHint?: string,
): boolean {
  if (process.env.CALIBRATION_EXTRACT_DEBUG === "1") return true;
  return /\b2527039693\b/.test(textOrReportHint ?? "");
}

const WRONG_FIELD_KEY_ALIASES = [
  "pavilion_angle",
  "pavilion",
  "girdleDescription",
  "girdleText",
  "girdle_thickness",
] as const;

/** Log merge-boundary snapshots for pavilionAngle / girdle hydration forensics. */
export function logHydrationMergeBoundary(
  label: string,
  fields: CalibrationReportFields,
  extra?: Record<string, unknown>,
): void {
  const probe = String(
    extra?.reportNumberHint ?? extra?.forensicProbe ?? "",
  );
  if (!shouldLogForensicHydration(probe)) return;

  const fieldKeysOnObject = Object.keys(fields);
  const unexpectedKeys = fieldKeysOnObject.filter(
    (k) => !(REPORT_FIELD_KEYS as readonly string[]).includes(k),
  );
  const aliasHits = WRONG_FIELD_KEY_ALIASES.filter((k) => k in fields);

  console.log(
    `[${label}]`,
    JSON.stringify(
      {
        pavilionAnglePresent: Boolean(fields.pavilionAngle?.trim()),
        girdlePresent: Boolean(fields.girdle?.trim()),
        populatedFieldKeys: EXTRACT_PIPELINE_FIELD_KEYS.filter((k) =>
          Boolean(fields[k]?.trim()),
        ),
        unexpectedKeys,
        aliasHits,
      },
      null,
      2,
    ),
  );
}

export function logFinalDiagnosticBeforeReturn(
  lab: string,
  reportNumber: string,
  fields: CalibrationReportFields,
): void {
  if (lab !== "GIA" || reportNumber !== "2527039693") return;
  console.log(
    "[FINAL DIAGNOSTIC BEFORE RETURN]",
    JSON.stringify(
      {
        pavilionAnglePresent: Boolean(fields.pavilionAngle?.trim()),
        girdlePresent: Boolean(fields.girdle?.trim()),
        populatedFieldKeys: EXTRACT_PIPELINE_FIELD_KEYS.filter((k) =>
          Boolean(fields[k]?.trim()),
        ),
      },
      null,
      2,
    ),
  );
}
