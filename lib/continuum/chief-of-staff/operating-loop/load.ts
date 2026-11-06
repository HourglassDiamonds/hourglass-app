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
import { candidateDispositionCorrectionEvents } from "@/lib/continuum/concierge-sol/founder-command";
import { cookies } from "next/headers";
import { after } from "next/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseConditionalHoldRepository } from "@/lib/continuum/sterling/holds/supabase";
import { reconcileConditionalHolds } from "@/lib/continuum/sterling/holds/reconcile";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { tagStoredGeneratedOperatingMailCandidates } from "@/lib/continuum/gmail/candidates/tag-stored-generated-load";
import {
  loadIndexedTodayThreadContext,
  loadLiveTodayOperationalFacts,
} from "@/lib/continuum/gmail/today-thread-context";
import { createSupabaseGmailConnectionStore } from "@/lib/continuum/gmail/server";
import { loadTrustedProjectThreadAssociations } from "@/lib/continuum/project-evidence/today-associations";
import {
  partitionIndexedTodayLiveThreadIds,
  planTodayLiveThreads,
  recentAnsweredUnresolvedIdentityThreadIds,
} from "@/lib/continuum/gmail/today-required-thread-set";
import {
  emitTodayCanonicalInputCounts,
  emitTodayLiveEnrichmentDiagnostics,
  emitTodayPipelineFailure,
  emitTodayUnindexedSourceRefCount,
} from "@/lib/continuum/today-enrichment-telemetry";
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
  todayRecomputeUnavailable,
  waitForTodayRecompute,
} from "./today-read-model";
import { parseGmailWebHref } from "./evidence";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { selectMasterSprintCapacityItems } from "./master-sprint";
import {
  isOperationalCandidate,
  isOperationalConditionalHold,
  isOperationalProjectJob,
  isOperationalProjectSummary,
} from "./operational-fixtures";
import {
  COS_DISCONNECTED_DETAIL,
  COS_DISCONNECTED_HEADING,
} from "./present";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosMasterSprintItem,
  type CosOperatingLoopView,
  type TodayCorrespondenceStatus,
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

function liveThreadPlan(
  loop: CosOperatingLoopView,
  candidates: readonly ContinuumCandidate[],
  nowIso: string,
  currentProviderThreadIds?: ReadonlySet<string>,
): ReturnType<typeof planTodayLiveThreads> {
  const docket = finalizeTodayDocket(loop);
  const recentAnsweredIdentityThreads = recentAnsweredUnresolvedIdentityThreadIds({
    candidates,
    threadContext: loop.threadContext ?? new Map(),
    nowIso,
  });
  return planTodayLiveThreads({
    ...docket,
    candidates,
    associatedGmailThreadsByProject: loop.associatedGmailThreadsByProject,
    currentProviderThreadIds,
    unresolvedIdentityThreadIds: [
      ...unassignedLiveIdentityThreadIds(docket, loop),
      ...recentAnsweredIdentityThreads,
    ],
  });
}

function currentProviderThreads(
  context: ReadonlyMap<string, import("@/lib/continuum/candidates/founder-attention").TodayGmailThreadContext>,
  authorizationAt: string | null | undefined,
): ReadonlySet<string> | undefined {
  const authorizationMs = Date.parse(authorizationAt ?? "");
  if (!Number.isFinite(authorizationMs)) return undefined;
  return new Set(
    [...context.entries()]
      .filter(([, thread]) => (thread.messages ?? []).some((message) => {
        const indexedMs = Date.parse(message.indexedAt ?? "");
        return Number.isFinite(indexedMs) && indexedMs > authorizationMs;
      }))
      .map(([threadId]) => threadId),
  );
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
  const [jobs, summaries, listed, masterSprint, knownPeople, activeHolds, gmailConnection] = await Promise.all([
    client ? loadProjectJobs(client) : Promise.resolve(null),
    desk.ok ? desk.reader.listProjects() : Promise.resolve([]),
    store.ok ? store.store.list() : Promise.resolve([] as ContinuumCandidate[]),
    loadMasterSprintCapacity(),
    loadTodayKnownEmailPeople(),
    client ? loadActiveConditionalHolds(client) : Promise.resolve([]),
    client ? createSupabaseGmailConnectionStore(client).getFounderConnection() : Promise.resolve(null),
  ]);
  emitTodayCanonicalInputCounts({
    jobsConnected: jobs !== null,
    jobCount: jobs?.length ?? 0,
    projectCount: summaries.length,
    candidateCount: listed.length,
  });
  const candidates = await tagStoredGeneratedOperatingMailCandidates(
    client,
    listed,
  );
  const operationalSummaries = summaries.filter(isOperationalProjectSummary);
  const trustedProjectThreads = client
    ? await loadTrustedProjectThreadAssociations(
        client,
        new Set(operationalSummaries.map((summary) => summary.projectId)),
      )
    : new Map<string, string>();
  const indexedContext = await loadIndexedTodayThreadContext(candidates, {
    ...(client ? { client } : {}),
    additionalThreadIds: [...trustedProjectThreads.keys()],
  });
  const currentProviderThreadIds = currentProviderThreads(
    indexedContext,
    gmailConnection?.connectedAt,
  );
  const currentOrTrustedThreadIds = new Set([
    ...(currentProviderThreadIds ?? []),
    ...trustedProjectThreads.keys(),
  ]);
  const operationalCandidates = candidates.filter((candidate) =>
    isOperationalCandidate(candidate, currentOrTrustedThreadIds),
  );
  const operationalProjectIds = new Set(operationalSummaries.map((summary) => summary.projectId));
  const operationalJobs = jobs?.filter((job) => isOperationalProjectJob(job, operationalProjectIds)) ?? jobs;
  const operationalHolds = activeHolds.filter(isOperationalConditionalHold);
  const founderCorrections = [
    ...(client ? await loadFounderCorrectionEvents(client) : []),
    ...candidateDispositionCorrectionEvents(operationalCandidates),
  ];
  const composeInput = {
    founderCorrections,
    jobs: operationalJobs,
    summaries: operationalSummaries,
    candidates: operationalCandidates,
    nowIso: now.toISOString(),
    masterSprint,
    threadContext: indexedContext,
    trustedProjectThreads,
    knownPeople,
    heldJobIds: new Set(operationalHolds.map((row) => row.entityId)),
  };
  let threadContext = indexedContext;
  let loop = composeCosOperatingLoop(composeInput);
  const attemptedThreadIds = new Set<string>();
  const unavailableIndexedThreadIds = new Set<string>();
  const criticalOutcomes = new Map<string, "complete_live" | "indexed_excerpt_only" | "unavailable">();
  for (let pass = 0; pass < 2; pass += 1) {
    const plan = liveThreadPlan(loop, operationalCandidates, now.toISOString(), currentProviderThreadIds);
    const critical = partitionIndexedTodayLiveThreadIds({
      requiredThreadIds: plan.criticalThreadIds,
      threadContext,
      attemptedThreadIds,
    });
    for (const threadId of critical.unavailable) unavailableIndexedThreadIds.add(threadId);
    if (critical.eligible.length > 0) {
      threadContext = await loadLiveTodayOperationalFacts(threadContext, {
        threadIds: critical.eligible,
        // Gmail completeness gates Sterling, but cannot make canonical work disappear.
        requireComplete: false,
        onDiagnostics: emitTodayLiveEnrichmentDiagnostics,
        onThreadOutcome: (outcome) => criticalOutcomes.set(outcome.threadId, outcome.status),
      });
      for (const threadId of critical.eligible) {
        attemptedThreadIds.add(threadId);
      }
    }
    const identity = partitionIndexedTodayLiveThreadIds({
      requiredThreadIds: plan.identityThreadIds,
      threadContext,
      attemptedThreadIds,
    });
    for (const threadId of identity.unavailable) unavailableIndexedThreadIds.add(threadId);
    if (identity.eligible.length > 0) {
      threadContext = await loadLiveTodayOperationalFacts(threadContext, {
        threadIds: identity.eligible,
        requireComplete: false,
        onDiagnostics: emitTodayLiveEnrichmentDiagnostics,
      });
      for (const threadId of identity.eligible) {
        attemptedThreadIds.add(threadId);
      }
    }
    if (critical.eligible.length === 0 && identity.eligible.length === 0) break;
    loop = composeCosOperatingLoop({ ...composeInput, threadContext });
  }
  const unresolvedRequired = liveThreadPlan(loop, operationalCandidates, now.toISOString(), currentProviderThreadIds).criticalThreadIds.filter(
    (threadId) =>
      !attemptedThreadIds.has(threadId) &&
      !unavailableIndexedThreadIds.has(threadId) &&
      Boolean(threadContext.get(threadId)?.messages?.length),
  );
  if (unresolvedRequired.length > 0) {
    throw new Error("today-live-enrichment-required-set-moved");
  }
  if (unavailableIndexedThreadIds.size > 0) {
    emitTodayUnindexedSourceRefCount(unavailableIndexedThreadIds.size);
  }
  if (client && operationalJobs) {
    await reconcileConditionalHolds({
      repository: new SupabaseConditionalHoldRepository(client),
      jobs: operationalJobs,
      events: sourceEventsIn(loop),
      now,
    }).catch(() => []);
  }
  const finalRequired = liveThreadPlan(loop, operationalCandidates, now.toISOString(), currentProviderThreadIds).criticalThreadIds;
  const completedRequired = finalRequired.filter(
    (threadId) => criticalOutcomes.get(threadId) === "complete_live",
  ).length;
  const correspondenceStatus: TodayCorrespondenceStatus = finalRequired.length === 0
    ? "not-required"
    : completedRequired === finalRequired.length
      ? "complete"
      : completedRequired > 0
        ? "partial"
        : "unavailable";
  return { ...loop, todayCorrespondenceStatus: correspondenceStatus };
}

async function loadActiveConditionalHolds(client: SupabaseClient) {
  try {
    return await new SupabaseConditionalHoldRepository(client).listActive();
  } catch {
    // The additive hold migration may intentionally be unapplied. In that case
    // Today retains its pre-feature behavior and no work is silently hidden.
    return [];
  }
}

function sourceEventsIn(value: unknown): SourceCommunicationEvent[] {
  const found = new Map<string, SourceCommunicationEvent>();
  const visit = (node: unknown, key = ""): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const child of node) visit(child, key); return; }
    const row = node as Record<string, unknown>;
    if (key === "sourceEvents" && typeof row.sourceRef === "string" && typeof row.timestamp === "string") {
      found.set(`${row.sourceRef}|${row.timestamp}`, row as unknown as SourceCommunicationEvent);
      return;
    }
    for (const [childKey, child] of Object.entries(row)) visit(child, childKey);
  };
  visit(value);
  return [...found.values()];
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
        loop.todayCorrespondenceStatus,
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
  } catch (error) {
    emitTodayPipelineFailure("continuum.today.snapshot_publish_failed", error);
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
  beginTodayRecompute(watermark, async () => {
    try {
      await run();
    } catch (error) {
      emitTodayPipelineFailure("continuum.today.recompute_failed", error);
      throw error;
    }
  });
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
  readModelStatus: "ready" | "refreshing" | "unavailable";
  readModelWatermark: string | null;
  snapshotComposedAt: string | null;
  correspondenceStatus?: TodayCorrespondenceStatus;
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
    readModelStatus: freshness === "refreshing" ? "refreshing" : "ready",
    readModelWatermark: watermark,
    snapshotComposedAt: loop.asOfIso ?? null,
    correspondenceStatus: loop.todayCorrespondenceStatus,
  };
}

function disconnectedPage(): TodayPageModel {
  return pageFromLoop(disconnectedLoop(), "current", null);
}

function reconstructionUnavailablePage(): TodayPageModel {
  return {
    ...pageFromLoop({
      ...disconnectedLoop(),
      heading: "Today couldn't refresh.",
      quietDetail: "Canonical Open Jobs remain connected. Try again shortly.",
    }, "current", null),
    readModelStatus: "unavailable",
  };
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
      const pending = scheduled || todayRecomputeInFlight();
      const page = pageFromLoop(
        lastKnown.loop,
        pending ? "refreshing" : "current",
        lastKnown.watermark,
      );
      return {
        ...page,
        readModelStatus: !pending && watermark && todayRecomputeUnavailable(watermark, now.getTime())
          ? "unavailable"
          : page.readModelStatus,
      };
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
        readModelStatus: "ready",
        readModelWatermark: snapshot.sourceWatermark,
        snapshotComposedAt: snapshot.composedAt,
        correspondenceStatus: snapshot.payload.correspondenceStatus,
      };
    }
    if (snapshot && snapshotUse === "refreshing") {
      const scheduled = watermark ? await scheduleTodayRebuild(now, watermark) : false;
      const pending = scheduled || todayRecomputeInFlight();
      return {
        docket: snapshot.payload.docket,
        freshness: pending ? "refreshing" : "current",
        readModelStatus: !pending && watermark && todayRecomputeUnavailable(watermark, now.getTime())
          ? "unavailable"
          : pending ? "refreshing" : "ready",
        readModelWatermark: snapshot.sourceWatermark,
        snapshotComposedAt: snapshot.composedAt,
        correspondenceStatus: snapshot.payload.correspondenceStatus,
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
  } catch (error) {
    emitTodayPipelineFailure("continuum.today.authenticated_read_failed", error);
    return reconstructionUnavailablePage();
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
