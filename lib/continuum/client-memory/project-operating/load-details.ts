/**
 * Bounded batched reads of the active Custom / Repair operating layer.
 * Collects Project IDs by canonical Kind, then at most two .in() queries.
 * Does not create rows. Does not infer Kind from subtype existence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectKind } from "../project-kind";
import type { ProjectCustomDetails, ProjectRepairDetails } from "../types";
import { collectActiveOperatingProjectIds } from "./layer";
import {
  CUSTOM_DETAIL_COLUMNS,
  REPAIR_DETAIL_COLUMNS,
  rowToCustomDetails,
  rowToRepairDetails,
} from "./rows";

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  fallback: string,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? fallback);
  return data ?? [];
}

export async function loadActiveOperatingDetails(
  client: SupabaseClient,
  profiles: ReadonlyArray<{ projectId: string; projectKind?: ProjectKind | null }>,
): Promise<{
  customDetails: ProjectCustomDetails[];
  repairDetails: ProjectRepairDetails[];
}> {
  const { customProjectIds, repairProjectIds } =
    collectActiveOperatingProjectIds(profiles);
  const [customRows, repairRows] = await Promise.all([
    customProjectIds.length > 0
      ? rows<Record<string, unknown>>(
          client
            .from("continuum_project_custom_details")
            .select(CUSTOM_DETAIL_COLUMNS)
            .in("project_id", customProjectIds),
          "read-project-custom-details-failed",
        )
      : Promise.resolve([]),
    repairProjectIds.length > 0
      ? rows<Record<string, unknown>>(
          client
            .from("continuum_project_repair_details")
            .select(REPAIR_DETAIL_COLUMNS)
            .in("project_id", repairProjectIds),
          "read-project-repair-details-failed",
        )
      : Promise.resolve([]),
  ]);
  return {
    customDetails: customRows.flatMap((row) => {
      const mapped = rowToCustomDetails(row);
      return mapped ? [mapped] : [];
    }),
    repairDetails: repairRows.flatMap((row) => {
      const mapped = rowToRepairDetails(row);
      return mapped ? [mapped] : [];
    }),
  };
}
