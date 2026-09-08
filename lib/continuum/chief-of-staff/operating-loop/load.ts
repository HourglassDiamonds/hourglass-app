/**
 * Server-only CoS operating-loop loader.
 * Reads Open Jobs, Project Desk titles, and Candidates.
 * Does not write. Does not call Gmail. Does not activate shadow CoS briefs.
 */

import "server-only";

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { composeCosOperatingLoop } from "./compose";
import {
  COS_DISCONNECTED_DETAIL,
  COS_DISCONNECTED_HEADING,
} from "./present";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosOperatingLoopView,
} from "./types";

function disconnectedLoop(): CosOperatingLoopView {
  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "disconnected",
    heading: COS_DISCONNECTED_HEADING,
    quietDetail: COS_DISCONNECTED_DETAIL,
    top5: [],
    remainingCount: 0,
    recap: [],
    anomalies: [],
    proposedActions: [],
  };
}

export async function loadCosOperatingLoop(
  now = new Date(),
): Promise<CosOperatingLoopView> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return disconnectedLoop();

  try {
    const client = getSupabaseAdmin();
    const jobs = client ? await loadProjectJobs(client) : null;
    const desk = await getAuthenticatedProjectDeskReader();
    const summaries = desk.ok ? await desk.reader.listProjects() : [];
    const store = await getAuthenticatedCandidateStore();
    const candidates: ContinuumCandidate[] = store.ok
      ? await store.store.list()
      : [];
    return composeCosOperatingLoop({
      jobs,
      summaries,
      candidates,
      nowIso: now.toISOString(),
    });
  } catch {
    return disconnectedLoop();
  }
}
