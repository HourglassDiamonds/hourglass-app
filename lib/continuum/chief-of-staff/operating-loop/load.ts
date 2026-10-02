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

import { loadFounderCorrectionEvents } from "./founder-corrections-load";
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
  loadLiveTodayOperationalFacts,
} from "@/lib/continuum/gmail/today-thread-context";
import { requiredTodayLiveThreadIds } from "@/lib/continuum/gmail/today-required-thread-set";
import { emitTodayLiveEnrichmentDiagnostics } from "@/lib/continuum/today-enrichment-telemetry";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import {
  CURRENT_OPERATING_BACKLOG,
  hydrateOperatingBacklogFromPersistence,
} from "@/lib/agent-os/operating-backlog";
import { resolvePersistenceAdapter } from "@/lib/agent-os/persistence/resolve";
import { readTodaySourceWatermark } from "@/lib/continuum/today-source-watermark";
import { beginTodayRecomputeAttempt } from "./today-recompute-clock";
import { decideSnapshotUse, projectTodaySnapshot } from "@/lib/continuum/today-snapshot";
import {
  publishPersistedTodaySnapshot,
  readPersistedTodaySnapshot,
} from "@/lib/continuum/today-snapshot-store";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket, type CosTodayDocketView } from "./docket";
import { finalizeTodayDocket } from "./today-docket-boundary";
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
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
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

function unassignedLiveIdentityThreadIds(
  docket: ReturnType<typeof finalizeTodayDocket>,
  loop: CosOperatingLoopView,
): string[] {
  const ids = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (id) ids.add(id);
  };
  const addHref = (href: string | null | undefined) => {
    const ref = href ?? "";
    add(
      parseGmailCandidateSourceRef(ref)?.threadId ??
        parseGmailWebHref(ref)?.threadId,
    );
  };
  for (const item of docket.upNext) {
    const unresolved =
      item.subject === "Unassigned" ||
      item.briefingPacket?.entityType === "unknown" ||
      Boolean(
        item.brief &&
          !item.brief.personLabel &&
          !item.brief.organizationLabel,
      );
    if (!unresolved) continue;
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
  for (const item of docket.watching) {
    if (item.briefingPacket?.entityType !== "unknown") continue;
    for (const ref of item.briefingPacket.sourceRefs) addHref(ref);
    for (const event of item.briefingPacket.sourceEvents ?? []) {
      add(event.threadId);
      addHref(event.sourceRef);
    }
  }
  return [...ids].filter(
    (threadId) =>
      loop.threadContext?.get(threadId)?.liveEnrichmentAttempted !== true,
  );
}

function requiredLiveThreadIds(
  loop: CosOperatingLoopView,
  candidates: readonly ContinuumCandidate[],
): string[] {
  const docket = finalizeTodayDocket(loop);
  return requiredTodayLiveThreadIds({
    ...docket,
    candidates,
    associatedGmailThreadsByProject: loop.associatedGmailThreadsByProject,
    unresolvedIdentityThreadIds: unassignedLiveIdentityThreadIds(docket, loop),
  });
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
  const founderCorrections = client ? await loadFounderCorrectionEvents(client) : [];
  const composeInput = {
    founderCorrections,
    jobs,
    summaries,
    candidates,
    nowIso: now.toISOString(),
    masterSprint,
    threadContext: indexedContext,
    knownPeople,
  };
  let threadContext = indexedContext;
  let loop = composeCosOperatingLoop(composeInput);
  const enrichedThreadIds = new Set<string>();
  for (let pass = 0; pass < 2; pass += 1) {
    const required = requiredLiveThreadIds(loop, candidates);
    const pending = required.filter(
      (threadId) => !enrichedThreadIds.has(threadId),
    );
    if (pending.length === 0) break;
    threadContext = await loadLiveTodayOperationalFacts(threadContext, {
      threadIds: pending,
      requireComplete: true,
      onDiagnostics: emitTodayLiveEnrichmentDiagnostics,
    });
    for (const threadId of pending) enrichedThreadIds.add(threadId);
    loop = composeCosOperatingLoop({ ...composeInput, threadContext });
  }
  const unresolvedRequired = requiredLiveThreadIds(loop, candidates).filter(
    (threadId) => !enrichedThreadIds.has(threadId),
  );
  if (unresolvedRequired.length > 0) {
    throw new Error("today-live-enrichment-required-set-moved");
  }
  return loop;
}

async function liveWatermark(
  fallback: string | null,
  evaluationTime = new Date(),
): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return fallback;
  try {
    return await readTodaySourceWatermark(client, evaluationTime);
  } catch {
    return fallback;
  }
}

async function commitComposedLoop(
  composedWatermark: string | null,
  loop: CosOperatingLoopView,
  composedAt: string,
  evaluationTime = new Date(composedAt),
): Promise<"published" | "moved" | "skipped"> {
  if (!composedWatermark || loop.status === "disconnected") return "skipped";
  const live = await liveWatermark(composedWatermark, evaluationTime);
  if (live !== composedWatermark) return "moved";
  const client = getSupabaseAdmin();
  if (!client) {
    storeCachedTodayLoop(composedWatermark, Date.now(), loop);
    return "published";
  }
  try {
    const result = await publishPersistedTodaySnapshot(client, {
      composedWatermark,
      payload: projectTodaySnapshot(
        composeTodayDocket(loop),
        loop.attentionValidUntil ?? null,
      ),
      composedAt,
      evaluationTime: evaluationTime.toISOString(),
    });
    if (result === "published") {
      storeCachedTodayLoop(composedWatermark, Date.now(), loop);
      return "published";
    }
    if (result === "current") return "published";
    if (result === "stale" || result === "lost-race") return "moved";
  } catch {
    // A missing table or a lost race leaves the previous snapshot in place.
  }
  return "skipped";
}

async function scheduleTodayRebuild(now: Date, watermark: string): Promise<boolean> {
  if (!shouldScheduleTodayRecompute(watermark, now.getTime())) return false;
  const run = async () => {
    const [desk, store] = await Promise.all([
      getAuthenticatedProjectDeskReader(),
      getAuthenticatedCandidateStore(),
    ]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const evaluation = await beginTodayRecomputeAttempt((evaluationTime) =>
        liveWatermark(watermark, evaluationTime),
      );
      const evaluationTime = evaluation.evaluationTime;
      const composedFor = evaluation.watermark;
      if (!composedFor) throw new Error("today recompute disconnected");
      const loop = await rebuildTodayLoop(evaluationTime, composedFor, { desk, store });
      if (loop.status === "disconnected") {
        throw new Error("today recompute disconnected");
      }
      const committed = await commitComposedLoop(
        composedFor,
        loop,
        evaluationTime.toISOString(),
        evaluationTime,
      );
      if (committed !== "moved") return;
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
    client ? liveWatermark(null, now) : Promise.resolve(null),
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
      hasLastKnown: Boolean(lastKnown && lastKnown.watermark === watermark),
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
      nowIso: now.toISOString(),
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
    const committed = await commitComposedLoop(
      watermark,
      loop,
      now.toISOString(),
      now,
    );
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
        watermark = await readTodaySourceWatermark(client, now);
      } catch {
        watermark = null;
      }
    }
    const cached = watermark ? readCachedTodayLoop(watermark, now.getTime()) : null;
    const lastKnown = readLastKnownTodayLoop();
    const choice = chooseTodayNavigation({
      exactHit: Boolean(cached),
      hasLastKnown: Boolean(lastKnown && lastKnown.watermark === watermark),
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
    await commitComposedLoop(watermark, loop, now.toISOString(), now);
    return presentLoop(loop, "current", watermark);
  } catch {
    return disconnectedLoop();
  }
}

/** Mutation barrier: await old background work, then publish current canonical truth. */
export async function refreshTodayAfterFounderMutation(): Promise<void> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  if (!session.ok) throw new Error("unauthorized");
  await waitForTodayRecompute();
  const now = new Date();
  const watermark = await liveWatermark(null, now);
  const loop = await rebuildTodayLoop(now, watermark);
  if (loop.status === "disconnected") throw new Error("today-refresh-failed");
  const committed = await commitComposedLoop(
    watermark,
    loop,
    now.toISOString(),
    now,
  );
  if (committed !== "published") throw new Error("today-changed-during-refresh");
}

export async function readAuthenticatedTodayWatermark(): Promise<string | null> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  const now = new Date();
  return session.ok ? liveWatermark(null, now) : null;
}
