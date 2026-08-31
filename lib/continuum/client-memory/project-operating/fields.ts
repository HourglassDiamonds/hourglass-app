/**
 * Closed V1 Custom / Repair operating-detail fields.
 * Project ID is identity. Kind gates writes. Founder-explicit only.
 */

import type { ProjectKind } from "../project-kind";
import {
  CUSTOM_OPERATING_DETAIL_FIELDS,
  REPAIR_OPERATING_DETAIL_FIELDS,
  OPERATING_DETAIL_FIELDS,
  type CustomOperatingDetailField,
  type OperatingDetailField,
  type ProjectCustomDetails,
  type ProjectRepairDetails,
  type RepairOperatingDetailField,
} from "../types";

export {
  CUSTOM_OPERATING_DETAIL_FIELDS,
  REPAIR_OPERATING_DETAIL_FIELDS,
  OPERATING_DETAIL_FIELDS,
  type CustomOperatingDetailField,
  type OperatingDetailField,
  type RepairOperatingDetailField,
};

export const OPERATING_DETAIL_MAX_LENGTH = 4000;

export const CUSTOM_OPERATING_LAYER_TITLE = "CUSTOM / NEW JEWELRY";
export const REPAIR_OPERATING_LAYER_TITLE = "REPAIR / SERVICE";
export const OPERATING_DETAIL_NOT_SET = "Not set";

export const OPERATING_DETAIL_FIELD_LABELS: Record<OperatingDetailField, string> =
  {
    custom_design_brief: "Design Brief",
    custom_design_requirements: "Design Requirements",
    custom_manufacturing_notes: "Manufacturing Notes",
    repair_item_description: "Item Description",
    repair_requested_service: "Requested Service",
    repair_condition_notes: "Condition Notes",
    repair_technical_notes: "Technical Notes",
  };

export const CUSTOM_DETAIL_KEYS: Record<
  CustomOperatingDetailField,
  keyof Pick<
    ProjectCustomDetails,
    "designBrief" | "designRequirements" | "manufacturingNotes"
  >
> = {
  custom_design_brief: "designBrief",
  custom_design_requirements: "designRequirements",
  custom_manufacturing_notes: "manufacturingNotes",
};

export const REPAIR_DETAIL_KEYS: Record<
  RepairOperatingDetailField,
  keyof Pick<
    ProjectRepairDetails,
    "itemDescription" | "requestedService" | "conditionNotes" | "technicalNotes"
  >
> = {
  repair_item_description: "itemDescription",
  repair_requested_service: "requestedService",
  repair_condition_notes: "conditionNotes",
  repair_technical_notes: "technicalNotes",
};

export function isCustomOperatingDetailField(
  value: unknown,
): value is CustomOperatingDetailField {
  return (
    typeof value === "string" &&
    (CUSTOM_OPERATING_DETAIL_FIELDS as readonly string[]).includes(value)
  );
}

export function isRepairOperatingDetailField(
  value: unknown,
): value is RepairOperatingDetailField {
  return (
    typeof value === "string" &&
    (REPAIR_OPERATING_DETAIL_FIELDS as readonly string[]).includes(value)
  );
}

export function isOperatingDetailField(
  value: unknown,
): value is OperatingDetailField {
  return (
    typeof value === "string" &&
    (OPERATING_DETAIL_FIELDS as readonly string[]).includes(value)
  );
}

export function requiredKindForOperatingField(
  field: OperatingDetailField,
): Extract<ProjectKind, "custom_new_jewelry" | "repair_service"> {
  return isCustomOperatingDetailField(field)
    ? "custom_new_jewelry"
    : "repair_service";
}

export function operatingLayerRouteForField(
  field: OperatingDetailField,
): "custom" | "repair" {
  return isCustomOperatingDetailField(field) ? "custom" : "repair";
}

export function emptyCustomDetails(
  projectId: string,
  at: string,
): ProjectCustomDetails {
  return {
    projectId,
    designBrief: null,
    designRequirements: null,
    manufacturingNotes: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function emptyRepairDetails(
  projectId: string,
  at: string,
): ProjectRepairDetails {
  return {
    projectId,
    itemDescription: null,
    requestedService: null,
    conditionNotes: null,
    technicalNotes: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function currentCustomFieldValue(
  details: ProjectCustomDetails | null | undefined,
  field: CustomOperatingDetailField,
): string | null {
  return details?.[CUSTOM_DETAIL_KEYS[field]] ?? null;
}

export function currentRepairFieldValue(
  details: ProjectRepairDetails | null | undefined,
  field: RepairOperatingDetailField,
): string | null {
  return details?.[REPAIR_DETAIL_KEYS[field]] ?? null;
}

export function withCustomFieldValue(
  details: ProjectCustomDetails,
  field: CustomOperatingDetailField,
  value: string | null,
  updatedAt: string,
): ProjectCustomDetails {
  return {
    ...details,
    updatedAt,
    [CUSTOM_DETAIL_KEYS[field]]: value,
  };
}

export function withRepairFieldValue(
  details: ProjectRepairDetails,
  field: RepairOperatingDetailField,
  value: string | null,
  updatedAt: string,
): ProjectRepairDetails {
  return {
    ...details,
    updatedAt,
    [REPAIR_DETAIL_KEYS[field]]: value,
  };
}
