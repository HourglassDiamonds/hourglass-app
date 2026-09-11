/**
 * Server-only CoS operating-loop loader.
 * Reads Open Jobs, Project Desk titles, and Candidates.
 * Does not write. Does not call the Gmail API. Does not activate shadow CoS briefs.
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
import { tagStoredGeneratedOperatingMailCandidates } from "@/lib/continuum/gmail/candidates/tag-stored-generated-load";
import {
  CURRENT_OPERATING_BACKLOG,
  hydrateOperatingBacklogFromPersistence,
} from "@/lib/agent-os/operating-backlog";
import { resolvePersistenceAdapter } from "@/lib/agent-os/persistence/resolve";
import { composeCosOperatingLoop } from "./compose";
import { selectMasterSprintCapacityItems } from "./master-sprint";
import {
  COS_DISCONNECTED_DETAIL,
  COS_DISCONNECTED_HEADING,
} from "./present";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosMasterSprintItem,
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
    brief: [],
    watching: [],
    recap: [],
    anomalies: [],
    proposedActions: [],
    needsYourDecision: [],
    worthKnowing: [],
    masterSprint: [],
  };
}

async function loadMasterSprintCapacity(): Promise<readonly CosMasterSprintItem[]> {
  let backlog = CURRENT_OPERATING_BACKLOG;
  try {
    const resolved = resolvePersistenceAdapter({ mode: "live" });
    if (resolved.store.liveEligible && resolved.store.isDurable) {
      const prior = await resolved.store.load();
      backlog = hydrateOperatingBacklogFromPersistence(
        CURRENT_OPERATING_BACKLOG,
        prior.recommendations,
      ).backlog;
    }
  } catch {
    backlog = CURRENT_OPERATING_BACKLOG;
  }
  return selectMasterSprintCapacityItems(backlog);
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
    const listed: ContinuumCandidate[] = store.ok
      ? await store.store.list()
      : [];
    const candidates = await tagStoredGeneratedOperatingMailCandidates(
      client,
      listed,
    );
    const masterSprint = await loadMasterSprintCapacity();
    return composeCosOperatingLoop({
      jobs,
      summaries,
      candidates,
      nowIso: now.toISOString(),
      masterSprint,
    });
  } catch {
    return disconnectedLoop();
  }
}
