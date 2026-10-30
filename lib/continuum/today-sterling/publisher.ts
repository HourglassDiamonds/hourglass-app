import "server-only";

import { loadTodaySurface, type TodayPageModel } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadAuthenticatedSterlingTodayPublisherProposal } from "./action-runtime";
import { isSterlingTodayPreviewPublisherEnabled } from "./server-config";
import { projectSterlingTodaySurface } from "./publisher-projection";

/** Default-off Preview bridge with a non-destructive legacy fallback. */
export async function loadPreviewIntegratedTodaySurface(now = new Date()): Promise<TodayPageModel> {
  const legacy = await loadTodaySurface(now);
  if (!isSterlingTodayPreviewPublisherEnabled()) return legacy;
  try {
    const proposal = await loadAuthenticatedSterlingTodayPublisherProposal();
    return proposal ? projectSterlingTodaySurface(legacy, proposal) : legacy;
  } catch {
    return legacy;
  }
}
