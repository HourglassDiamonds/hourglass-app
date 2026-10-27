"use server";

import { cookies } from "next/headers";
import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { calendarFeedbackCommitments } from "@/lib/continuum/calendar/today-upcoming";
import { loadTodayUpcoming } from "@/lib/continuum/calendar/today-upcoming-load";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import {
  cosFeedbackIsCached,
  noteCosFeedbackCacheHit,
  noteCosFeedbackUnavailable,
  refreshCosFeedback,
} from "@/lib/continuum/cos-feedback/feedback";
import { cosFeedbackSolModel, cosFeedbackSolRoute } from "@/lib/continuum/cos-feedback/sol-adapter";

export const COS_FEEDBACK_EXPLICIT_INTENT = "settle-cos-feedback" as const;

export async function settleCosFeedback(formData: FormData): Promise<{ refresh: boolean }> {
  if (String(formData.get("intent") ?? "") !== COS_FEEDBACK_EXPLICIT_INTENT) {
    return { refresh: false };
  }
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { refresh: false };
  const [today, upcoming] = await Promise.all([loadTodaySurface(), loadTodayUpcoming()]);
  const sourceWatermark = today.readModelWatermark;
  if (!sourceWatermark || today.docket.showDisconnected) return { refresh: false };
  const nowIso = new Date().toISOString();
  const input = {
    docket: today.docket,
    sourceWatermark,
    nowIso,
    calendarCommitments: calendarFeedbackCommitments(upcoming),
  };
  const model = cosFeedbackSolModel();
  if (!model) {
    noteCosFeedbackUnavailable(input);
    return { refresh: false };
  }
  const route = cosFeedbackSolRoute();
  if (cosFeedbackIsCached(input)) {
    noteCosFeedbackCacheHit({ ...input, route });
    return { refresh: false };
  }
  await refreshCosFeedback({ ...input, model, route });
  return { refresh: true };
}
