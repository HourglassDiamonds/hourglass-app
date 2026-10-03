import "server-only";

import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { composeTodayDocket } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { loadCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import type {
  CosDocketItemView,
  CosOperatingLoopView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { parseSterlingIntent, runSterling } from "./engine";
import { getAuthenticatedSterlingProposalRepository } from "./ledger/load";
import { markSterlingLedgerUnavailable, persistSterlingResponse } from "./ledger/persist";
import type { SterlingOwner, SterlingResponse, SterlingTodayItem, SterlingTruth } from "./types";

export async function runAuthenticatedSterlingQuery(
  query: string,
  now = new Date(),
): Promise<SterlingResponse | null> {
  const intent = parseSterlingIntent(query);
  if (!intent) return null;
  const truth = await loadSterlingTruth(now);
  const ledger = await getAuthenticatedSterlingProposalRepository();
  const proposalHistory = ledger.ok
    ? await ledger.repository.listRecentDecisions(100).catch(() => [])
    : [];
  const response = runSterling({
    truth,
    intent,
    modelOverride: process.env.STERLING_MODEL,
    now,
    proposalHistory,
  });
  if (!ledger.ok) {
    return markSterlingLedgerUnavailable(
      response,
      ledger.reason === "not-activated" ? "not-activated" : "unavailable",
    );
  }
  return persistSterlingResponse(ledger.repository, response, truth);
}

export async function loadSterlingTruth(now = new Date()): Promise<SterlingTruth> {
  const loop = await loadCosOperatingLoop(now);
  if (loop.status === "disconnected") return disconnectedTruth(now);

  const [jobs, candidates] = await Promise.all([loadJobs(), loadCandidates()]);
  const docket = composeTodayDocket(loop);
  const today = [
    ...docket.items.map((item) => fromDocketItem(item, jobs)),
    ...docket.watching.map((item) => fromWatchingItem(item, jobs)),
  ];
  return {
    generatedAt: now.toISOString(),
    sourceWatermark: loop.todayReadModelWatermark ?? null,
    sourceStatus: loop.todayFreshness === "refreshing" ? "refreshing" : "current",
    today: dedupeToday(today),
    openJobs: jobs,
    candidates,
    anomalies: loop.anomalies.map((row) => ({
      id: row.id,
      kind: row.kind,
      headline: row.headline,
      detail: row.detail,
      jobId: row.jobId,
      projectId: row.projectId,
      sourceRefs: row.sourceHref ? [row.sourceHref] : [],
    })),
  };
}

async function loadJobs(): Promise<ProjectJob[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];
  try {
    return (await loadProjectJobs(client)) ?? [];
  } catch {
    return [];
  }
}

async function loadCandidates() {
  const auth = await getAuthenticatedCandidateStore();
  if (!auth.ok) return [];
  try {
    return await auth.store.list();
  } catch {
    return [];
  }
}

function fromDocketItem(item: CosDocketItemView, jobs: readonly ProjectJob[]): SterlingTodayItem {
  const packet = item.briefingPacket ?? item.brief?.briefingPacket ?? null;
  const job = item.job ? jobs.find((row) => row.jobId === item.job!.id) ?? null : null;
  const refs = unique([
    ...(packet?.sourceRefs ?? []),
    ...(item.job?.sourceRef ? [item.job.sourceRef] : []),
  ]);
  return {
    id: item.job?.id ?? item.id,
    title: item.headline || item.subject,
    why: item.context || item.job?.why || item.subject,
    projectId: packet?.projectId ?? item.job?.projectId ?? null,
    projectTitle: packet?.projectName ?? item.job?.projectTitle ?? null,
    personName: item.job?.clientLabel ?? packet?.displayName ?? null,
    owner: ownerOf(packet?.ballHolder ?? item.job?.ownership ?? "founder"),
    state: item.briefing?.stateChip ?? packet?.lifecycle ?? "Up next",
    proposedNextAction: packet?.candidateNextAction ?? item.headline ?? null,
    dueAt: job?.dueAt ?? null,
    sourceRefs: refs,
    authoritative: item.todayDocketVersion === "authoritative_v1" &&
      (item.origin === "master_sprint" || packet != null || item.job != null),
    clientFacing: Boolean(packet?.projectId || packet?.personId || item.job?.clientLabel),
    productionBlocker:
      packet?.semanticNextActionClass === "founder_print_check" ||
      /production|print|cad|shop/i.test(`${item.headline} ${item.context ?? ""}`),
  };
}

function fromWatchingItem(item: CosWatchingItem, jobs: readonly ProjectJob[]): SterlingTodayItem {
  const packet = item.briefingPacket ?? null;
  const jobId = item.attention?.jobId ?? null;
  const job = jobId ? jobs.find((row) => row.jobId === jobId) ?? null : null;
  return {
    id: jobId ?? item.id,
    title: item.title,
    why: item.detail,
    projectId: packet?.projectId ?? item.projectId,
    projectTitle: packet?.projectName ?? item.title,
    personName: packet?.displayName ?? null,
    owner: ownerOf(packet?.ballHolder ?? item.attention?.waitingOnActor ?? job?.waitingOnActor ?? "unknown"),
    state: item.briefing?.stateChip ?? "Watching",
    proposedNextAction: packet?.candidateNextAction ?? null,
    dueAt: job?.dueAt ?? null,
    sourceRefs: unique([...(packet?.sourceRefs ?? []), ...(job?.sourceRef ? [job.sourceRef] : [])]),
    authoritative: item.todayDocketVersion === "authoritative_v1" &&
      (packet != null || item.attention?.canonical === true),
    clientFacing: Boolean(packet?.projectId || packet?.personId),
    productionBlocker: false,
  };
}

function ownerOf(value: string): SterlingOwner {
  if (/founder|hourglass|your turn/i.test(value)) return "founder";
  if (/client/i.test(value)) return "client";
  if (/vendor|shop|production/i.test(value)) return "shop";
  return "unknown";
}

function dedupeToday(rows: readonly SterlingTodayItem[]): SterlingTodayItem[] {
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id)));
}

function unique(rows: readonly string[]): string[] {
  return [...new Set(rows.filter(Boolean))];
}

function disconnectedTruth(now: Date): SterlingTruth {
  return {
    generatedAt: now.toISOString(),
    sourceWatermark: null,
    sourceStatus: "disconnected",
    today: [],
    openJobs: [],
    candidates: [],
    anomalies: [],
  };
}

export function sterlingTruthFromLoop(
  loop: CosOperatingLoopView,
  openJobs: readonly ProjectJob[],
  now = new Date(),
): SterlingTruth {
  if (loop.status === "disconnected") return disconnectedTruth(now);
  const docket = composeTodayDocket(loop);
  return {
    generatedAt: now.toISOString(),
    sourceWatermark: loop.todayReadModelWatermark ?? null,
    sourceStatus: loop.todayFreshness === "refreshing" ? "refreshing" : "current",
    today: dedupeToday([
      ...docket.items.map((item) => fromDocketItem(item, openJobs)),
      ...docket.watching.map((item) => fromWatchingItem(item, openJobs)),
    ]),
    openJobs,
    candidates: [],
    anomalies: loop.anomalies.map((row) => ({
      id: row.id,
      kind: row.kind,
      headline: row.headline,
      detail: row.detail,
      jobId: row.jobId,
      projectId: row.projectId,
      sourceRefs: row.sourceHref ? [row.sourceHref] : [],
    })),
  };
}
