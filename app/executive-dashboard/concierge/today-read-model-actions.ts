"use server";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import {
  readLastKnownTodayLoop,
  todayRecomputeInFlight,
  todayRecomputeUnavailable,
} from "@/lib/continuum/chief-of-staff/operating-loop/today-read-model";

export type TodayRecomputeProbe = {
  pending: boolean;
  unavailable: boolean;
  cacheWatermark: string | null;
};

export async function probeTodayRecompute(): Promise<TodayRecomputeProbe> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { pending: false, unavailable: false, cacheWatermark: null };
  const last = readLastKnownTodayLoop();
  return {
    pending: todayRecomputeInFlight(),
    unavailable: todayRecomputeUnavailable(),
    cacheWatermark: last?.watermark ?? null,
  };
}

export async function probeTodayCanonicalWatermark(): Promise<string | null> {
  const { readAuthenticatedTodayWatermark } = await import("@/lib/continuum/chief-of-staff/operating-loop/load");
  return readAuthenticatedTodayWatermark();
}
