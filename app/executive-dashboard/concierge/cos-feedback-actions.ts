"use server";

import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import {
  cosFeedbackIsCached,
  refreshCosFeedback,
} from "@/lib/continuum/cos-feedback/feedback";
import { cosFeedbackSolModel } from "@/lib/continuum/cos-feedback/sol-adapter";

export async function settleCosFeedback(): Promise<{ refresh: boolean }> {
  const today = await loadTodaySurface();
  const sourceWatermark = today.readModelWatermark;
  if (!sourceWatermark || today.docket.showDisconnected) return { refresh: false };
  const model = cosFeedbackSolModel();
  if (!model) return { refresh: false };
  const nowIso = new Date().toISOString();
  const input = { docket: today.docket, sourceWatermark, nowIso };
  if (cosFeedbackIsCached(input)) return { refresh: false };
  await refreshCosFeedback({ ...input, model });
  return { refresh: true };
}
