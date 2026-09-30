/**
 * Authenticated server adapter. Reuses the existing Continuum read world and
 * therefore inherits its founder-session boundary without exposing writers.
 */

import "server-only";

import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { loadConciergeSolWorld } from "@/lib/continuum/concierge-sol/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { ContinuumAgentWorld } from "./world";

export type LoadedContinuumAgentWorld =
  | { ok: true; world: ContinuumAgentWorld }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function loadContinuumAgentWorld(): Promise<LoadedContinuumAgentWorld> {
  const loaded = await loadConciergeSolWorld();
  if (!loaded.ok) return loaded;
  const client = getSupabaseAdmin();
  return {
    ok: true,
    world: {
      ...loaded.world,
      listProjectlessJobs: () =>
        client ? loadProjectJobs(client, null) : Promise.resolve(null),
      async loadTodayItems(limit) {
        const today = await loadTodaySurface();
        return today.docket.items.slice(0, limit).map((item) => ({
          jobId: item.origin === "open_job" ? item.job?.id ?? null : null,
          title: item.headline,
          detail: item.context ?? item.headline,
          projectTitle:
            item.job?.projectTitle ??
            item.brief?.projectTitle ??
            item.decision?.projectTitle ??
            null,
          personName: item.job?.clientLabel ?? item.brief?.personLabel ?? null,
        }));
      },
    },
  };
}
