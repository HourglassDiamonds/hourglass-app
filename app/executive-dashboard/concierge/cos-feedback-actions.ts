"use server";

import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import {
  cosFeedbackIsCached,
  noteCosFeedbackCacheHit,
  noteCosFeedbackUnavailable,
  refreshCosFeedback,
} from "@/lib/continuum/cos-feedback/feedback";
import { cosFeedbackSolModel, cosFeedbackSolRoute } from "@/lib/continuum/cos-feedback/sol-adapter";

export async function settleCosFeedback(): Promise<{ refresh: boolean }> {
  const today = await loadTodaySurface();
  const sourceWatermark = today.readModelWatermark;
  if (!sourceWatermark || today.docket.showDisconnected) return { refresh: false };
  const nowIso = new Date().toISOString();
  const input = { docket: today.docket, sourceWatermark, nowIso };
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
