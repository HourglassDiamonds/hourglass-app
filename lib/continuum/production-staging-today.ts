import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isVerifiedContinuumProductionStagingRuntime } from "@/lib/continuum/runtime-env";
import { readPersistedTodaySnapshot } from "@/lib/continuum/today-snapshot-store";
import { readTodaySourceWatermark } from "@/lib/continuum/today-source-watermark";
import type { TodaySnapshotRecord } from "@/lib/continuum/today-snapshot";

export type ProductionStagingTodayStatus =
  | "ready"
  | "stale"
  | "absent"
  | "unavailable";

export type ProductionStagingTodayRead = {
  status: ProductionStagingTodayStatus;
  snapshot: TodaySnapshotRecord | null;
  liveWatermark: string | null;
};

export function classifyProductionStagingToday(input: {
  snapshot: TodaySnapshotRecord | null;
  liveWatermark: string | null;
  nowIso: string;
}): ProductionStagingTodayStatus {
  if (!input.snapshot) return "absent";
  if (!input.liveWatermark) return "unavailable";
  const validUntil = Date.parse(input.snapshot.payload.validUntil ?? "");
  const now = Date.parse(input.nowIso);
  if (Number.isFinite(validUntil) && (!Number.isFinite(now) || now >= validUntil)) {
    return "stale";
  }
  return input.snapshot.sourceWatermark === input.liveWatermark
    ? "ready"
    : "stale";
}

/**
 * Production-backed staging read boundary. This deliberately bypasses the
 * normal Today loader because that loader may rebuild, reconcile, enrich from
 * Gmail, schedule background work, and publish a replacement snapshot.
 */
export async function loadProductionStagingToday(
  now = new Date(),
): Promise<ProductionStagingTodayRead> {
  if (!isVerifiedContinuumProductionStagingRuntime()) {
    return { status: "unavailable", snapshot: null, liveWatermark: null };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { status: "unavailable", snapshot: null, liveWatermark: null };
  }
  const snapshot = await readPersistedTodaySnapshot(client).catch(() => null);
  if (!snapshot) {
    return { status: "absent", snapshot: null, liveWatermark: null };
  }
  const liveWatermark = await readTodaySourceWatermark(client, now).catch(() => null);
  return {
    status: classifyProductionStagingToday({
      snapshot,
      liveWatermark,
      nowIso: now.toISOString(),
    }),
    snapshot,
    liveWatermark,
  };
}
