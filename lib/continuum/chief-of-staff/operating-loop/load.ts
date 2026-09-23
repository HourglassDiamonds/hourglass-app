/**
 * Server-only CoS operating-loop loader.
 * Reads Open Jobs, Project Desk titles, Candidates, and indexed Gmail
 * thread subjects plus message timestamps/direction/labels for Today identity
 * and thread truth-state. Recovers exact thread chronology from persisted
 * thread ids, then message ids. May fetch live From metadata for identity-
 * unresolved Gmail cards, using recovered Gmail thread ids. Does not write.
 * Does not activate shadow CoS briefs.
 */

import "server-only";

import { cookies } from "next/headers";
import { after } from "next/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { tagStoredGeneratedOperatingMailCandidates } from "@/lib/continuum/gmail/candidates/tag-stored-generated-load";
import {
  loadIndexedTodayThreadContext,
  loadLiveExternalThreadIdentity,
  mergeTodayThreadContext,
} from "@/lib/continuum/gmail/today-thread-context";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import {
  CURRENT_OPERATING_BACKLOG,
  hydrateOperatingBacklogFromPersistence,
} from "@/lib/agent-os/operating-backlog";
import { resolvePersistenceAdapter } from "@/lib/agent-os/persistence/resolve";
import { readTodaySourceWatermark } from "@/lib/continuum/today-source-watermark";
import { decideSnapshotUse, projectTodaySnapshot } from "@/lib/continuum/today-snapshot";
import {
  publishPersistedTodaySnapshot,
  readPersistedTodaySnapshot,
} from "@/lib/continuum/today-snapshot-store";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket, type CosTodayDocketView } from "./docket";
import {
  beginTodayRecompute,
  chooseTodayNavigation,
  readCachedTodayLoop,
  readLastKnownTodayLoop,
  shouldScheduleTodayRecompute,
  storeCachedTodayLoop,
  todayRecomputeInFlight,
  waitForTodayRecompute,
} from "./today-read-model";
import { parseGmailWebHref } from "./evidence";
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

function unassignedLiveIdentityThreadIds(loop: CosOperatingLoopView): string[] {
  const ids = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (id) ids.add(id);
  };
  const addHref = (href: string | null | undefined) => {
    const parsed = parseGmailWebHref(href ?? "");
    if (parsed?.threadId) add(parsed.threadId);
  };
  for (const item of composeTodayDocket(loop).items) {
    const unresolved =
      item.subject === "Unassigned" ||
      (!item.brief?.personLabel && !item.brief?.organizationLabel);
    if (!unresolved && item.subject !== "Unassigned") continue;
    add(item.brief?.recoveredGmailThreadId);
    add(item.brief?.canonicalGmailThreadId);
    for (const beat of item.brief?.evidence ?? []) {
      if (beat.generatedSource === true) continue;
      addHref(beat.sourceHref);
    }
    for (const action of item.brief?.actions ?? []) {
      if (action.kind !== "open_email") continue;
      addHref(action.href);
    }
    addHref(item.decision?.sourceHref);
  }
  for (const brief of loop.brief) {
    if (brief.personLabel || brief.organizationLabel) continue;
    add(brief.recoveredGmailThreadId);
    add(brief.canonicalGmailThreadId);
  }
  return [...ids];
}

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

function presentLoop(
  loop: CosOperatingLoopView,
  freshness: "current" | "refreshing",
  watermark: string | null,
): CosOperatingLoopView {
  return {
    ...loop,
    todayFreshness: freshness,
    todayReadModelWatermark: watermark,
  };
}

async function rebuildTodayLoop(
  now: Date,
  watermark: string | null,
  prepared?: {
    desk: Awaited<ReturnType<typeof getAuthenticatedProjectDeskReader>>;
    store: Awaited<ReturnType<typeof getAuthenticatedCandidateStore>>;
  },
): Promise<CosOperatingLoopView> {
  const client = getSupabaseAdmin();
  const [desk, store] = prepared
    ? [prepared.desk, prepared.store]
    : await Promise.all([
        getAuthenticatedProjectDeskReader(),
        getAuthenticatedCandidateStore(),
      ]);
  const [jobs, summaries, listed, masterSprint, knownPeople] = await Promise.all([
    client ? loadProjectJobs(client) : Promise.resolve(null),
    desk.ok ? desk.reader.listProjects() : Promise.resolve([]),
    store.ok ? store.store.list() : Promise.resolve([] as ContinuumCandidate[]),
    loadMasterSprintCapacity(),
    loadTodayKnownEmailPeople(),
  ]);
  const candidates = await tagStoredGeneratedOperatingMailCandidates(
    client,
    listed,
  );
  const indexedContext = await loadIndexedTodayThreadContext(candidates);
  const composeInput = {
    jobs,
    summaries,
    candidates,
    nowIso: now.toISOString(),
    masterSprint,
    threadContext: indexedContext,
    knownPeople,
  };
  let loop = composeCosOperatingLoop(composeInput);
  const unassignedThreads = unassignedLiveIdentityThreadIds(loop);
  if (unassignedThreads.length > 0) {
    const live = new Map<string, TodayGmailThreadContext>();
    for (const threadId of unassignedThreads) {
      const identity = await loadLiveExternalThreadIdentity(threadId);
      if (identity) live.set(threadId, identity);
    }
    if (live.size > 0) {
      loop = composeCosOperatingLoop({
        ...composeInput,
        threadContext: mergeTodayThreadContext(indexedContext, live),
      });
    }
  }
  return loop;
}

async function liveWatermark(fallback: string | null): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return fallback;
  try {
    return await readTodaySourceWatermark(client);
  } catch {
    return fallback;
  }
}

async function commitComposedLoop(
  composedWatermark: string | null,
  loop: CosOperatingLoopView,
  composedAt: string,
): Promise<"published" | "moved" | "skipped"> {
  if (!composedWatermark || loop.status === "disconnected") return "skipped";
  const live = await liveWatermark(composedWatermark);
  if (live !== composedWatermark) return "moved";
  storeCachedTodayLoop(composedWatermark, Date.now(), loop);
  const client = getSupabaseAdmin();
  if (!client) return "published";
  try {
    await publishPersistedTodaySnapshot(client, {
      composedWatermark,
      payload: projectTodaySnapshot(composeTodayDocket(loop)),
      composedAt,
    });
  } catch {
    // A missing table or a lost race leaves the previous snapshot in place.
  }
  return "published";
}

async function scheduleTodayRebuild(now: Date, watermark: string): Promise<boolean> {
  if (!shouldScheduleTodayRecompute(watermark, now.getTime())) return false;
  const [desk, store] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedCandidateStore(),
  ]);
  const run = async () => {
    let composedFor = await liveWatermark(watermark);
    if (!composedFor) throw new Error("today recompute disconnected");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const loop = await rebuildTodayLoop(now, composedFor, { desk, store });
      if (loop.status === "disconnected") {
        throw new Error("today recompute disconnected");
      }
      const committed = await commitComposedLoop(composedFor, loop, now.toISOString());
      if (committed !== "moved") return;
      const live = await liveWatermark(composedFor);
      if (!live || live === composedFor) return;
      composedFor = live;
    }
    throw new Error("today recompute watermark moved");
  };
  beginTodayRecompute(watermark, run);
  try {
    after(() => waitForTodayRecompute());
  } catch {
    // The recompute is already running in this process.
  }
  return true;
}

export type TodayPageModel = {
  docket: CosTodayDocketView;
  freshness: "current" | "refreshing";
  readModelWatermark: string | null;
};

function pageFromLoop(
  loop: CosOperatingLoopView,
  freshness: "current" | "refreshing",
  watermark: string | null,
): TodayPageModel {
  const presented = presentLoop(loop, freshness, watermark);
  return {
    docket: composeTodayDocket(presented),
    freshness,
    readModelWatermark: watermark,
  };
}

function disconnectedPage(): TodayPageModel {
  return pageFromLoop(disconnectedLoop(), "current", null);
}

export async function loadTodaySurface(now = new Date()): Promise<TodayPageModel> {
  const jar = await cookies();
  const client = getSupabaseAdmin();
  const [session, watermark, snapshot] = await Promise.all([
    requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value),
    client ? liveWatermark(null) : Promise.resolve(null),
    client
      ? readPersistedTodaySnapshot(client).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (!session.ok) return disconnectedPage();

  try {
    const cached = watermark ? readCachedTodayLoop(watermark, now.getTime()) : null;
    const lastKnown = readLastKnownTodayLoop();
    const choice = chooseTodayNavigation({
      exactHit: Boolean(cached),
      hasLastKnown: Boolean(lastKnown),
    });
    if (choice === "current" && cached) {
      return pageFromLoop(cached, "current", watermark);
    }
    if (choice === "refreshing" && lastKnown) {
      const scheduled = watermark ? await scheduleTodayRebuild(now, watermark) : false;
      return pageFromLoop(
        lastKnown.loop,
        scheduled || todayRecomputeInFlight() ? "refreshing" : "current",
        lastKnown.watermark,
      );
    }
    const snapshotUse = decideSnapshotUse({
      record: snapshot,
      liveWatermark: watermark,
    });
    if (snapshot && snapshotUse === "current") {
      return {
        docket: snapshot.payload.docket,
        freshness: "current",
        readModelWatermark: snapshot.sourceWatermark,
      };
    }
    if (snapshot && snapshotUse === "refreshing") {
      const scheduled = watermark ? await scheduleTodayRebuild(now, watermark) : false;
      return {
        docket: snapshot.payload.docket,
        freshness: scheduled || todayRecomputeInFlight() ? "refreshing" : "current",
        readModelWatermark: snapshot.sourceWatermark,
      };
    }
    const loop = await rebuildTodayLoop(now, watermark);
    if (loop.status === "disconnected") return disconnectedPage();
    const committed = await commitComposedLoop(watermark, loop, now.toISOString());
    if (committed === "moved" && watermark) {
      await scheduleTodayRebuild(now, watermark);
      return pageFromLoop(loop, "refreshing", watermark);
    }
    return pageFromLoop(loop, "current", watermark);
  } catch {
    return disconnectedPage();
  }
}

export async function loadCosOperatingLoop(
  now = new Date(),
): Promise<CosOperatingLoopView> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return disconnectedLoop();

  try {
    const client = getSupabaseAdmin();
    let watermark: string | null = null;
    if (client) {
      try {
        watermark = await readTodaySourceWatermark(client);
      } catch {
        watermark = null;
      }
    }
    const cached = watermark ? readCachedTodayLoop(watermark, now.getTime()) : null;
    const lastKnown = readLastKnownTodayLoop();
    const choice = chooseTodayNavigation({
      exactHit: Boolean(cached),
      hasLastKnown: Boolean(lastKnown),
    });
    if (choice === "current" && cached) {
      return presentLoop(cached, "current", watermark);
    }
    if (choice === "refreshing" && lastKnown) {
      const scheduled = watermark ? await scheduleTodayRebuild(now, watermark) : false;
      return presentLoop(
        lastKnown.loop,
        scheduled || todayRecomputeInFlight() ? "refreshing" : "current",
        lastKnown.watermark,
      );
    }
    const loop = await rebuildTodayLoop(now, watermark);
    await commitComposedLoop(watermark, loop, now.toISOString());
    return presentLoop(loop, "current", watermark);
  } catch {
    return disconnectedLoop();
  }
}
