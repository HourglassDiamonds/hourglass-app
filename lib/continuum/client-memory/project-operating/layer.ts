/**
 * Active Custom / Repair operating layer from canonical Kind.
 * Dormant subtype rows are ignored. Existence of a row does not set Kind.
 */

import type { ProjectKind } from "../project-kind";
import type {
  CustomOperatingDetailField,
  OperatingDetailField,
  ProjectCustomDetails,
  ProjectRepairDetails,
  RepairOperatingDetailField,
} from "../types";
import {
  CUSTOM_OPERATING_DETAIL_FIELDS,
  CUSTOM_OPERATING_LAYER_TITLE,
  OPERATING_DETAIL_FIELD_LABELS,
  REPAIR_OPERATING_DETAIL_FIELDS,
  REPAIR_OPERATING_LAYER_TITLE,
  currentCustomFieldValue,
  currentRepairFieldValue,
} from "./fields";

export type OperatingLayerField = {
  fieldName: OperatingDetailField;
  label: string;
  value: string | null;
};

export type ProjectOperatingLayer =
  | {
      kind: "custom_new_jewelry";
      title: typeof CUSTOM_OPERATING_LAYER_TITLE;
      fields: Array<{
        fieldName: CustomOperatingDetailField;
        label: string;
        value: string | null;
      }>;
    }
  | {
      kind: "repair_service";
      title: typeof REPAIR_OPERATING_LAYER_TITLE;
      fields: Array<{
        fieldName: RepairOperatingDetailField;
        label: string;
        value: string | null;
      }>;
    }
  | { kind: "none" };

export function activeOperatingLayer(input: {
  projectKind: ProjectKind | null | undefined;
  customDetails?: ProjectCustomDetails | null;
  repairDetails?: ProjectRepairDetails | null;
}): ProjectOperatingLayer {
  if (input.projectKind === "custom_new_jewelry") {
    return {
      kind: "custom_new_jewelry",
      title: CUSTOM_OPERATING_LAYER_TITLE,
      fields: CUSTOM_OPERATING_DETAIL_FIELDS.map((fieldName) => ({
        fieldName,
        label: OPERATING_DETAIL_FIELD_LABELS[fieldName],
        value: currentCustomFieldValue(input.customDetails, fieldName),
      })),
    };
  }
  if (input.projectKind === "repair_service") {
    return {
      kind: "repair_service",
      title: REPAIR_OPERATING_LAYER_TITLE,
      fields: REPAIR_OPERATING_DETAIL_FIELDS.map((fieldName) => ({
        fieldName,
        label: OPERATING_DETAIL_FIELD_LABELS[fieldName],
        value: currentRepairFieldValue(input.repairDetails, fieldName),
      })),
    };
  }
  return { kind: "none" };
}

export function customDetailsByProjectId(
  rows: readonly ProjectCustomDetails[] | undefined,
): Map<string, ProjectCustomDetails> {
  return new Map((rows ?? []).map((row) => [row.projectId, row]));
}

export function repairDetailsByProjectId(
  rows: readonly ProjectRepairDetails[] | undefined,
): Map<string, ProjectRepairDetails> {
  return new Map((rows ?? []).map((row) => [row.projectId, row]));
}

export function collectActiveOperatingProjectIds(
  profiles: ReadonlyArray<{ projectId: string; projectKind?: ProjectKind | null }>,
): { customProjectIds: string[]; repairProjectIds: string[] } {
  const customProjectIds: string[] = [];
  const repairProjectIds: string[] = [];
  for (const profile of profiles) {
    if (profile.projectKind === "custom_new_jewelry") {
      customProjectIds.push(profile.projectId);
    } else if (profile.projectKind === "repair_service") {
      repairProjectIds.push(profile.projectId);
    }
  }
  return { customProjectIds, repairProjectIds };
}
