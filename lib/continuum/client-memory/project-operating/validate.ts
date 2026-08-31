/**
 * Conservative validation for founder Custom / Repair operating-detail fields.
 * Blank trims to NULL. Does not infer, copy, or rename fields.
 */

import { isOperatingDetailField } from "./fields";
import {
  OPERATING_DETAIL_MAX_LENGTH,
  type OperatingDetailField,
} from "./fields";

export type OperatingDetailValidationFailure = "invalid-field" | "invalid-value";

export type OperatingDetailValidationResult =
  | { ok: true; field: OperatingDetailField; value: string | null }
  | { ok: false; reason: OperatingDetailValidationFailure };

function hasForbiddenControls(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code === 10 || code === 13) continue;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateOperatingDetailCorrection(
  fieldName: unknown,
  newValue: unknown,
): OperatingDetailValidationResult {
  if (!isOperatingDetailField(fieldName)) {
    return { ok: false, reason: "invalid-field" };
  }
  if (newValue == null) {
    return { ok: true, field: fieldName, value: null };
  }
  if (typeof newValue !== "string") {
    return { ok: false, reason: "invalid-value" };
  }
  const value = newValue.trim();
  if (!value) return { ok: true, field: fieldName, value: null };
  if (value.length > OPERATING_DETAIL_MAX_LENGTH || hasForbiddenControls(value)) {
    return { ok: false, reason: "invalid-value" };
  }
  return { ok: true, field: fieldName, value };
}
