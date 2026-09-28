"use server";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { estimateRepair } from "@/lib/continuum/repair-estimator/estimate";
import type { RepairEstimateOutcome } from "@/lib/continuum/repair-estimator/types";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export async function estimateRepairPrompt(
  prompt: string,
): Promise<RepairEstimateOutcome | { status: "unauthorized" }> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { status: "unauthorized" };
  return estimateRepair(prompt);
}
