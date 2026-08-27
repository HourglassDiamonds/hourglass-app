/**
 * Closed V1 founder-editable project spec fields.
 * Not a generic column editor. Finger size stays project-scoped.
 */

import { CONCIERGE_MANUAL_SOURCE_SYSTEM } from "../write/types";
import {
  EDITABLE_PROJECT_SPEC_FIELDS,
  type EditableProjectSpecField,
  type ProjectHistory,
  type ProjectHistoryRevision,
} from "../types";

export {
  EDITABLE_PROJECT_SPEC_FIELDS,
  type EditableProjectSpecField,
  type ProjectHistoryRevision,
};

export const PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM = CONCIERGE_MANUAL_SOURCE_SYSTEM;

export const PROJECT_SPEC_FIELD_LABELS: Record<EditableProjectSpecField, string> = {
  cad_job_number: "CAD",
  order_number: "Order",
  finger_size: "Finger size",
  metal: "Metal",
  center_stone: "Center stone",
  diamond_supply_notes: "Supply notes",
};

export const PROJECT_SPEC_HISTORY_KEY: Record<
  EditableProjectSpecField,
  keyof Pick<
    ProjectHistory,
    | "fingerSize"
    | "orderNumber"
    | "cadJobNumber"
    | "metal"
    | "centerStone"
    | "diamondSupplyNotes"
  >
> = {
  finger_size: "fingerSize",
  order_number: "orderNumber",
  cad_job_number: "cadJobNumber",
  metal: "metal",
  center_stone: "centerStone",
  diamond_supply_notes: "diamondSupplyNotes",
};

export const IDENTIFIER_SPEC_MAX_LENGTH = 64;
export const VOCABULARY_SPEC_MAX_LENGTH = 120;
export const SUPPLY_NOTES_MAX_LENGTH = 2000;

export const FINGER_SIZE_PATTERN =
  /^(?:[1-9]|[12]\d|30)(?:\.(?:0|00|25|5|50|75))?$/;

export function founderCorrectedFieldsOf(
  history: ProjectHistory,
): EditableProjectSpecField[] {
  return [...(history.founderCorrectedFields ?? [])];
}

export function currentSpecValue(
  history: ProjectHistory,
  field: EditableProjectSpecField,
): string | null {
  const value = history[PROJECT_SPEC_HISTORY_KEY[field]];
  return value ?? null;
}

export function withSpecValue(
  history: ProjectHistory,
  field: EditableProjectSpecField,
  value: string,
  updatedAt: string,
): ProjectHistory {
  const next: ProjectHistory = {
    ...history,
    updatedAt,
    [PROJECT_SPEC_HISTORY_KEY[field]]: value,
  };
  const protectedFields = new Set(founderCorrectedFieldsOf(history));
  protectedFields.add(field);
  next.founderCorrectedFields = [...protectedFields];
  return next;
}
