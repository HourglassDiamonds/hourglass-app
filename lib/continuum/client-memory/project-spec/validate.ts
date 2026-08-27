/**
 * Conservative field-specific validation for founder project-spec corrections.
 * Does not infer 141 → 14 or 14.1. Does not swap adjacent fields.
 */

import { isEditableProjectSpecField } from "../contracts";
import {
  FINGER_SIZE_PATTERN,
  IDENTIFIER_SPEC_MAX_LENGTH,
  SUPPLY_NOTES_MAX_LENGTH,
  VOCABULARY_SPEC_MAX_LENGTH,
  type EditableProjectSpecField,
} from "./types";

export type ProjectSpecValidationFailure =
  | "invalid-field"
  | "invalid-value"
  | "implausible-finger-size";

export type ProjectSpecValidationResult =
  | { ok: true; field: EditableProjectSpecField; value: string }
  | { ok: false; reason: ProjectSpecValidationFailure };

function hasForbiddenControls(value: string, allowNewlines: boolean): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code === 10 || code === 13) {
      if (!allowNewlines) return true;
      continue;
    }
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateProjectSpecCorrection(
  fieldName: unknown,
  newValue: unknown,
): ProjectSpecValidationResult {
  if (!isEditableProjectSpecField(fieldName)) {
    return { ok: false, reason: "invalid-field" };
  }
  if (typeof newValue !== "string") {
    return { ok: false, reason: "invalid-value" };
  }
  const value = newValue.trim();
  if (!value) return { ok: false, reason: "invalid-value" };

  if (fieldName === "finger_size") {
    if (!FINGER_SIZE_PATTERN.test(value)) {
      return { ok: false, reason: "implausible-finger-size" };
    }
    return { ok: true, field: fieldName, value };
  }

  if (fieldName === "order_number" || fieldName === "cad_job_number") {
    if (
      value.length > IDENTIFIER_SPEC_MAX_LENGTH ||
      hasForbiddenControls(value, false)
    ) {
      return { ok: false, reason: "invalid-value" };
    }
    return { ok: true, field: fieldName, value };
  }

  if (fieldName === "metal" || fieldName === "center_stone") {
    if (
      value.length > VOCABULARY_SPEC_MAX_LENGTH ||
      hasForbiddenControls(value, false)
    ) {
      return { ok: false, reason: "invalid-value" };
    }
    return { ok: true, field: fieldName, value };
  }

  if (
    value.length > SUPPLY_NOTES_MAX_LENGTH ||
    hasForbiddenControls(value, true)
  ) {
    return { ok: false, reason: "invalid-value" };
  }
  return { ok: true, field: fieldName, value };
}
