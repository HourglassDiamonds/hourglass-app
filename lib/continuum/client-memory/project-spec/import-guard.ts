/**
 * Field-level import guard for founder-corrected project specs.
 * Does not invent a broad authority framework.
 * Import may refresh uncorrected fields; founder-corrected fields stay current.
 */

import type { ProjectHistory } from "../types";
import {
  EDITABLE_PROJECT_SPEC_FIELDS,
  currentSpecValue,
  founderCorrectedFieldsOf,
  type EditableProjectSpecField,
} from "./types";

export function isFounderCorrectedProjectSpecField(
  history: ProjectHistory,
  field: EditableProjectSpecField,
): boolean {
  return founderCorrectedFieldsOf(history).includes(field);
}

export function mergeImportedProjectHistory(
  existing: ProjectHistory,
  incoming: ProjectHistory,
): ProjectHistory {
  const next: ProjectHistory = { ...existing };
  for (const field of EDITABLE_PROJECT_SPEC_FIELDS) {
    if (isFounderCorrectedProjectSpecField(existing, field)) continue;
    const incomingValue = currentSpecValue(incoming, field);
    const key =
      field === "finger_size"
        ? "fingerSize"
        : field === "order_number"
          ? "orderNumber"
          : field === "cad_job_number"
            ? "cadJobNumber"
            : field === "center_stone"
              ? "centerStone"
              : field === "diamond_supply_notes"
                ? "diamondSupplyNotes"
                : "metal";
    next[key] = incomingValue;
  }
  return next;
}

export function importedHistoryEqualsCurrent(
  existing: ProjectHistory,
  merged: ProjectHistory,
): boolean {
  for (const field of EDITABLE_PROJECT_SPEC_FIELDS) {
    if (currentSpecValue(existing, field) !== currentSpecValue(merged, field)) {
      return false;
    }
  }
  return true;
}
