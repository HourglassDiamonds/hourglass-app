import type { ReportFieldKey } from "@/lib/calibration-library/types";
import { CLIENT_FIELD_LABELS } from "./client-field-labels";

export const CLIENT_GIRDLE_OPTIONS = [
  "Very Thin",
  "Thin",
  "Medium",
  "Slightly Thick",
  "Thick",
  "Very Thick",
  "Medium to Slightly Thick (Faceted)",
  "Medium, Faceted",
  "None",
] as const;

export const CLIENT_CULET_OPTIONS = [
  "None",
  "Very Small",
  "Small",
  "Medium",
  "Large",
  "Pointed",
] as const;

export type ClientManualNumericField =
  | "tablePercent"
  | "depthPercent"
  | "crownAngle"
  | "pavilionAngle"
  | "lowerHalfPercent"
  | "starLengthPercent";

export type ClientManualFieldKey =
  | ClientManualNumericField
  | "girdle"
  | "culet";

const NUMERIC_RANGES: Record<
  ClientManualNumericField,
  { min: number; max: number; decimals?: number }
> = {
  tablePercent: { min: 45, max: 75 },
  depthPercent: { min: 50, max: 75 },
  crownAngle: { min: 25, max: 40, decimals: 1 },
  pavilionAngle: { min: 38, max: 42.5, decimals: 1 },
  lowerHalfPercent: { min: 60, max: 90 },
  starLengthPercent: { min: 35, max: 70 },
};

export type ManualFieldValidationResult =
  | {
      ok: true;
      normalized: string;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      warnings: string[];
    };

function stripNumericDecorators(raw: string): string {
  return raw
    .trim()
    .replace(/%/g, "")
    .replace(/°/g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, "");
}

function normalizeEnumInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function fuzzyEnumMatch(
  raw: string,
  options: readonly string[],
): string | null {
  const norm = normalizeEnumInput(raw).toLowerCase();
  if (!norm) return null;
  const exact = options.find((o) => o.toLowerCase() === norm);
  if (exact) return exact;
  const contains = options.find((o) => norm.includes(o.toLowerCase()));
  if (contains) return contains;
  return null;
}

export function validateClientManualField(
  key: ClientManualFieldKey,
  raw: string,
): ManualFieldValidationResult {
  const warnings: string[] = [];

  if (key === "girdle" || key === "culet") {
    const options = key === "girdle" ? CLIENT_GIRDLE_OPTIONS : CLIENT_CULET_OPTIONS;
    const matched = fuzzyEnumMatch(raw, options);
    if (!matched) {
      return {
        ok: false,
        error: `Choose a ${CLIENT_FIELD_LABELS[key].toLowerCase()} option from the list.`,
        warnings,
      };
    }
    return { ok: true, normalized: matched, warnings };
  }

  const cleaned = stripNumericDecorators(raw);
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return {
      ok: false,
      error: `Enter ${CLIENT_FIELD_LABELS[key]} as a number only.`,
      warnings,
    };
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error: `Enter a valid number for ${CLIENT_FIELD_LABELS[key]}.`,
      warnings,
    };
  }

  const range = NUMERIC_RANGES[key];
  if (value < range.min || value > range.max) {
    return {
      ok: false,
      error: `${CLIENT_FIELD_LABELS[key]} must be between ${range.min} and ${range.max}.`,
      warnings,
    };
  }

  const decimals = range.decimals ?? 0;
  const normalized =
    decimals > 0 ? String(Math.round(value * 10) / 10) : String(Math.round(value));

  return { ok: true, normalized, warnings };
}

export type CombinationCheckInput = Partial<
  Record<ClientManualNumericField, string>
>;

/** Client-friendly warnings for unusual but technically valid combinations. */
export function assessSuspiciousProportionCombinations(
  input: CombinationCheckInput,
): string[] {
  const warnings: string[] = [];
  const table = num(input.tablePercent);
  const depth = num(input.depthPercent);
  const crown = num(input.crownAngle);
  const pavilion = num(input.pavilionAngle);

  if (table !== null && depth !== null) {
    if (table > 65 && depth < 56) {
      warnings.push(
        "This table and depth combination is uncommon — double-check the proportion diagram.",
      );
    }
    if (table < 50 && depth > 68) {
      warnings.push(
        "This table and depth combination is uncommon — double-check the proportion diagram.",
      );
    }
  }

  if (crown !== null && pavilion !== null) {
    const sum = crown + pavilion;
    if (sum < 72 || sum > 78) {
      warnings.push(
        "These crown and pavilion angles are an unusual pair — confirm both on the report.",
      );
    }
  }

  return warnings;
}

function num(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(stripNumericDecorators(raw));
  return Number.isFinite(n) ? n : null;
}

const CLIENT_MANUAL_KEYS: ClientManualFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
];

export function isClientManualFieldKey(
  key: ReportFieldKey,
): key is ClientManualFieldKey {
  return (CLIENT_MANUAL_KEYS as ReportFieldKey[]).includes(key);
}
