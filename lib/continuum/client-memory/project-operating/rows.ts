/**
 * Row mappers for Custom / Repair operating-detail tables.
 * Does not insert. Does not infer Kind.
 */

import type { ProjectCustomDetails, ProjectRepairDetails } from "../types";

export const CUSTOM_DETAIL_COLUMNS =
  "project_id, design_brief, design_requirements, manufacturing_notes, created_at, updated_at";
export const REPAIR_DETAIL_COLUMNS =
  "project_id, item_description, requested_service, condition_notes, technical_notes, created_at, updated_at";

export function rowToCustomDetails(
  row: Record<string, unknown> | null | undefined,
): ProjectCustomDetails | null {
  if (!row || row.project_id == null) return null;
  return {
    projectId: String(row.project_id),
    designBrief: row.design_brief == null ? null : String(row.design_brief),
    designRequirements:
      row.design_requirements == null ? null : String(row.design_requirements),
    manufacturingNotes:
      row.manufacturing_notes == null ? null : String(row.manufacturing_notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function rowToRepairDetails(
  row: Record<string, unknown> | null | undefined,
): ProjectRepairDetails | null {
  if (!row || row.project_id == null) return null;
  return {
    projectId: String(row.project_id),
    itemDescription:
      row.item_description == null ? null : String(row.item_description),
    requestedService:
      row.requested_service == null ? null : String(row.requested_service),
    conditionNotes:
      row.condition_notes == null ? null : String(row.condition_notes),
    technicalNotes:
      row.technical_notes == null ? null : String(row.technical_notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
