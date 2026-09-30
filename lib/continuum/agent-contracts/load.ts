/**
 * Authenticated server adapter. Reuses the existing Continuum read world and
 * therefore inherits its founder-session boundary without exposing writers.
 */

import "server-only";

import { loadTodaySurface } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadConciergeSolWorld } from "@/lib/continuum/concierge-sol/load";
import type { ContinuumAgentWorld } from "./world";

export type LoadedContinuumAgentWorld =
  | { ok: true; world: ContinuumAgentWorld }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function loadContinuumAgentWorld(): Promise<LoadedContinuumAgentWorld> {
  const loaded = await loadConciergeSolWorld();
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    world: {
      ...loaded.world,
      async loadTodayItems(limit) {
        const today = await loadTodaySurface();
        return today.docket.items.slice(0, limit).map((item) => ({
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
