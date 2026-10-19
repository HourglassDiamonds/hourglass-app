/** Read-only Sterling-native Today assembly and semantic orchestration. */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { collectPagedRows } from "@/lib/continuum/candidates/page";
import { rowToCandidate } from "@/lib/continuum/candidates/rows";
import { CONTINUUM_CANDIDATES_TABLE } from "@/lib/continuum/candidates/activation";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import { SupabaseProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/supabase";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import { loadFounderCorrectionEvents } from "@/lib/continuum/chief-of-staff/operating-loop/founder-corrections-load";
import {
  loadIndexedTodayThreadContext,
  loadLiveTodayOperationalFacts,
  type TodayLiveEnrichmentDiagnostics,
  type TodayLiveThreadOutcome,
} from "@/lib/continuum/gmail/today-thread-context";
import type { LiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";
import { loadTodayUpcoming } from "@/lib/continuum/calendar/today-upcoming-load";
import {
  getContinuumCalendarFounderEmail,
  getContinuumCalendarTokenKek,
  isCalendarReadEnabled,
  isContinuumCalendarOAuthConfigured,
} from "@/lib/continuum/calendar/env";
import { readTodaySourceWatermark } from "@/lib/continuum/today-source-watermark";
import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import { buildSterlingTodayWorkingSet } from "./working-set";
import { requestSterlingTodayProposal } from "./request";
import { validateSterlingTodayProposal } from "./validate";
import { evaluateSterlingTodayAcceptance } from "./acceptance";
import { expandSterlingIndexedThreadContext, loadSterlingProjectThreadIds } from "./evidence-load";
import { buildSterlingTodayTargetWorkingSet, summarizeSterlingTodayTargetPackage } from "./target";
import {
  buildSterlingEvidenceReadyWorkingSet,
  evaluateSterlingEvidenceCompleteness,
  executeSterlingEvidenceGatedRequest,
  type SterlingEvidenceCompletenessReport,
} from "./evidence-completeness";
import type {
  SterlingPreviousTodayItem,
  SterlingTodayProposal,
  SterlingTodayValidationResult,
  SterlingTodayWorkingSet,
} from "./types";
import {
  STERLING_TODAY_ACCEPTANCE_SCOPE,
  acceptanceIdentifiers,
  acceptanceThreadIds,
  candidateScopeText,
  isDurablyScopedFounderCorrection,
  scopeDefinition,
  scopeMatchesIdentifierText,
  scopeMatchesOperationalIdentifier,
  scopeMatchesText,
  type SterlingTodayScopeDefinition,
} from "./scope";

export type SterlingCalendarDiagnostic = {
  diagnosis: string;
  readEnabled: boolean;
  oauthConfigured: boolean;
  tokenKekConfigured: boolean;
  founderMailboxConfigured: boolean;
  connectionStoreReadable: boolean;
  connectionPresent: boolean;
  connectionStatus: string | null;
  refreshTokenPresent: boolean;
  grantedReadonlyScope: boolean;
  lastReadPresent: boolean;
  connectionErrorPresent: boolean;
};

export type SterlingScopeCoverage = {
  publicId: string;
  resolved: boolean;
  resolution: "exact_identifier" | "exact_thread_scope" | "canonical_project" | "founder_correction" | "unresolved";
  workUnitIds: readonly string[];
};

export type SterlingTodayAssembly = {
  workingSet: SterlingTodayWorkingSet;
  requestWorkingSet: SterlingTodayWorkingSet;
  target: { caseId: string; selectedWorkUnitId: string; relatedWorkUnitIds: readonly string[] } | null;
  targetBlockedReason: "no-matching-work-unit" | "ambiguous-work-unit" | null;
  targetPackage: ReturnType<typeof summarizeSterlingTodayTargetPackage> | null;
  completeness: SterlingEvidenceCompletenessReport;
  scopeCoverage: readonly SterlingScopeCoverage[];
  calendar: SterlingCalendarDiagnostic & { todayItemsBeforeAcceptanceScope: number; scopedTodayItems: number };
  gmail: TodayLiveEnrichmentDiagnostics | null;
  counts: { people: number; projects: number; jobs: number; evidence: number; workUnits: number; gmailThreads: number; calendar: number };
  performance: { assemblyLatencyMs: number; serializedInputBytes: number; totalLatencyMs: number };
};

export type SterlingTodaySemanticCompletion = {
  assembly: SterlingTodayAssembly;
  called: boolean;
  blockedWorkUnitIds: readonly string[];
  proposal: SterlingTodayProposal | null;
  validation: SterlingTodayValidationResult | null;
  acceptance: ReturnType<typeof evaluateSterlingTodayAcceptance> | null;
  verdict: "PASS" | "TARGET_VALID" | "BLOCK" | "EVIDENCE_BLOCKED";
  performance: SterlingTodayAssembly["performance"] & {
    modelLatencyMs: number | null;
    inputBytes: number | null;
    outputBytes: number | null;
    tokenUsage: { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null } | null;
  };
};

export type SterlingTodaySafeResult = {
  ok: boolean;
  mode: "assembly" | "semantic";
  verdict: SterlingTodaySemanticCompletion["verdict"] | "ASSEMBLY_ONLY" | "UNAVAILABLE" | "DISABLED" | "BUSY";
  counts: SterlingTodayAssembly["counts"] | null;
  completeness: SterlingEvidenceCompletenessReport["aggregate"] | null;
  scope: { total: number; resolved: number; unresolved: number } | null;
  gmail: null | Pick<TodayLiveEnrichmentDiagnostics, "requestedThreadCount" | "completedThreadCount" | "failedThreadCount" | "threadFetches" | "durationMs" | "failuresByCode">;
  performance: null | SterlingTodaySemanticCompletion["performance"];
  validation: null | { accepted: boolean; errorCount: number; mutationProposalCount: number };
  safeErrors: readonly string[];
};

type AssembleInput = {
  client: SupabaseClient;
  now?: Date;
  targetCase?: string | null;
  createGmailBatch?: () => Promise<LiveSourceViewerBatch | null>;
};

async function loadCandidates(client: SupabaseClient): Promise<ContinuumCandidate[]> {
  const rows = await collectPagedRows(async (from, to) => {
    const result = await client.from(CONTINUUM_CANDIDATES_TABLE).select("*")
      .order("source_timestamp", { ascending: false }).range(from, to);
    if (result.error) throw result.error;
    return result.data ?? [];
  });
  return rows.flatMap((row) => {
    try { return [rowToCandidate(row as Record<string, unknown>)]; } catch { return []; }
  });
}

async function loadPreviousToday(client: SupabaseClient): Promise<SterlingPreviousTodayItem[]> {
  const { data } = await client.from("continuum_today_snapshots").select("payload")
    .eq("snapshot_key", "founder_today_v1").limit(1);
  const payload = (data as unknown as Array<{ payload?: unknown }> | null)?.[0]?.payload as
    { docket?: { items?: unknown[]; watching?: unknown[] } } | undefined;
  const rows = [...(payload?.docket?.items ?? []), ...(payload?.docket?.watching ?? [])];
  return rows.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    return [{
      itemId: String(row.id ?? `prior-${index}`),
      category: String(row.lane ?? "prior"),
      projectId: typeof row.projectId === "string" ? row.projectId : null,
      summary: String(row.headline ?? row.detail ?? row.title ?? row.subject ?? "Prior Today item").slice(0, 500),
    }];
  });
}

async function calendarDiagnostic(client: SupabaseClient): Promise<SterlingCalendarDiagnostic> {
  const result = await client.from("continuum_calendar_connections")
    .select("status, refresh_token_ciphertext, granted_scope, last_read_at, status_error_code")
    .eq("calendar_slot", "founder-v1").maybeSingle();
  const row = result.data as Record<string, unknown> | null;
  const enabled = isCalendarReadEnabled();
  const connectionStatus = row?.status == null ? null : String(row.status);
  const diagnosis = !enabled ? "read_disabled"
    : result.error ? "connection_store_unavailable"
      : !row ? "consent_required"
        : connectionStatus !== "connected" ? `connection_${connectionStatus ?? "invalid"}`
          : !row.refresh_token_ciphertext ? "refresh_token_missing"
            : !getContinuumCalendarTokenKek() ? "token_kek_missing"
              : !isContinuumCalendarOAuthConfigured() ? "oauth_configuration_missing"
                : "live_read_eligible";
  return {
    diagnosis,
    readEnabled: enabled,
    oauthConfigured: isContinuumCalendarOAuthConfigured(),
    tokenKekConfigured: Boolean(getContinuumCalendarTokenKek()),
    founderMailboxConfigured: Boolean(getContinuumCalendarFounderEmail()),
    connectionStoreReadable: !result.error,
    connectionPresent: Boolean(row),
    connectionStatus,
    refreshTokenPresent: Boolean(row?.refresh_token_ciphertext),
    grantedReadonlyScope: String(row?.granted_scope ?? "").includes("calendar.readonly"),
    lastReadPresent: Boolean(row?.last_read_at),
    connectionErrorPresent: Boolean(row?.status_error_code),
  };
}

function projectText(project: { title: string; specs?: readonly { value: string }[] }): string {
  return `${project.title} ${(project.specs ?? []).map((row) => row.value).join(" ")}`;
}

function candidateProjectId(candidate: ContinuumCandidate): string | null {
  const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
  return "projectId" in target ? target.projectId : null;
}

function definitionMatchesStableInput(definition: SterlingTodayScopeDefinition, text: string): boolean {
  if (definition.founderCorrectionOnly) return false;
  return scopeMatchesIdentifierText(definition, text);
}

function matchingUnits(
  workingSet: SterlingTodayWorkingSet,
  definition: SterlingTodayScopeDefinition,
  canonicalProjectIds: ReadonlySet<string>,
) {
  const evidence = new Map(workingSet.evidence.map((row) => [row.evidenceId, row]));
  return workingSet.workUnits.filter((unit) => {
    if ((definition.exactThreadIds ?? []).some((threadId) => unit.threadIds.includes(threadId))) return true;
    if (scopeMatchesOperationalIdentifier(definition, unit.observedIdentifiers)) return true;
    if (unit.projectId && canonicalProjectIds.has(unit.projectId)) return true;
    if (definition.founderCorrectionOnly) {
      return unit.evidenceRefs.some((ref) => {
        const row = evidence.get(ref);
        return row?.sourceType === "founder_directive" && row.sourceRef.startsWith("founder-note:") &&
          scopeMatchesText(definition, `${unit.label} ${row.excerpt ?? ""}`);
      });
    }
    return scopeMatchesText(definition, [unit.label, ...unit.observedIdentifiers].join(" "));
  });
}

function scopeCoverage(
  workingSet: SterlingTodayWorkingSet,
  canonicalProjectIdsByKey: ReadonlyMap<string, ReadonlySet<string>>,
): SterlingScopeCoverage[] {
  return STERLING_TODAY_ACCEPTANCE_SCOPE.map((definition) => {
    const canonicalProjectIds = canonicalProjectIdsByKey.get(definition.key) ?? new Set<string>();
    const units = matchingUnits(workingSet, definition, canonicalProjectIds);
    const exact = units.filter((unit) => scopeMatchesOperationalIdentifier(definition, unit.observedIdentifiers));
    const exactThread = units.filter((unit) => (definition.exactThreadIds ?? []).some((threadId) => unit.threadIds.includes(threadId)));
    const founderCorrection = units.filter((unit) => unit.evidenceRefs.some((ref) => {
      const evidence = workingSet.evidence.find((row) => row.evidenceId === ref);
      return evidence?.sourceType === "founder_directive" && evidence.sourceRef.startsWith("founder-note:");
    }));
    const canonical = units.filter((unit) => unit.kind === "canonical_project");
    const selected = exact.length === 1 ? exact : exactThread.length === 1 ? exactThread : founderCorrection.length === 1 ? founderCorrection
      : canonical.length === 1 ? canonical : [];
    return {
      publicId: definition.publicId,
      resolved: selected.length === 1,
      resolution: exact.length === 1 ? "exact_identifier"
        : exactThread.length === 1 ? "exact_thread_scope"
          : founderCorrection.length === 1 ? "founder_correction"
          : canonical.length === 1 ? "canonical_project" : "unresolved",
      workUnitIds: units.map((row) => row.workUnitId),
    };
  });
}

export async function assembleSterlingTodayShadow(input: AssembleInput): Promise<SterlingTodayAssembly> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const [candidates, projects, jobs, people, corrections, calendar, watermark, previousToday, calendarStatus] = await Promise.all([
    loadCandidates(input.client),
    new SupabaseProjectDeskReader(input.client as never).listProjects(),
    loadProjectJobs(input.client as never),
    loadTodayKnownEmailPeople(),
    loadFounderCorrectionEvents(input.client as never),
    loadTodayUpcoming(now),
    readTodaySourceWatermark(input.client as never, now),
    loadPreviousToday(input.client),
    calendarDiagnostic(input.client),
  ]);

  const anchoredCorrections = corrections.filter((event) =>
    STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) => isDurablyScopedFounderCorrection(definition, event)),
  );
  const anchoredProjectIds = new Set(anchoredCorrections.flatMap((event) => event.projectId ? [event.projectId] : []));
  const exactProjectIds = new Set(STERLING_TODAY_ACCEPTANCE_SCOPE.flatMap((definition) => [...(definition.exactProjectIds ?? [])]));
  const scopedProjects = projects.filter((project) => exactProjectIds.has(project.projectId) || anchoredProjectIds.has(project.projectId) ||
    STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) => definitionMatchesStableInput(definition, projectText(project))));
  const scopedProjectIds = new Set(scopedProjects.map((project) => project.projectId));
  const canonicalProjectIdsByKey = new Map<string, ReadonlySet<string>>(
    STERLING_TODAY_ACCEPTANCE_SCOPE.map((definition) => [definition.key, new Set([
      ...scopedProjects.filter((project) => definitionMatchesStableInput(definition, projectText(project)))
        .map((project) => project.projectId),
      ...scopedProjects.filter((project) => (definition.exactProjectIds ?? []).includes(project.projectId))
        .map((project) => project.projectId),
      ...anchoredCorrections.filter((event) => isDurablyScopedFounderCorrection(definition, event))
        .flatMap((event) => event.projectId ? [event.projectId] : []),
    ])]),
  );
  const scopedCandidates = candidates.filter((candidate) => {
    const projectId = candidateProjectId(candidate);
    const ids = collectExactGmailIds([candidate]);
    const exactThreadMatch = STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) =>
      ids.threadIds.some((threadId) => (definition.exactThreadIds ?? []).includes(threadId)));
    return exactThreadMatch || projectId != null && scopedProjectIds.has(projectId) || STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) =>
      definitionMatchesStableInput(definition, candidateScopeText(candidate)));
  });
  const exactJobIds = new Set(STERLING_TODAY_ACCEPTANCE_SCOPE.flatMap((definition) => [...(definition.exactJobIds ?? [])]));
  const scopedJobs = (jobs ?? []).filter((job) => exactJobIds.has(job.jobId) || job.projectId != null && scopedProjectIds.has(job.projectId) ||
    STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) =>
      definitionMatchesStableInput(definition, `${job.subject} ${job.detail ?? ""}`)));
  const scopedPeopleIds = new Set([
    ...scopedProjects.flatMap((project) => project.people.map((person) => person.personId)),
    ...STERLING_TODAY_ACCEPTANCE_SCOPE.flatMap((definition) => [...(definition.exactPersonIds ?? [])]),
  ]);
  const scopedPeople = people.filter((person) => scopedPeopleIds.has(person.personId));
  const scopedCorrections = corrections.filter((event) => anchoredCorrections.includes(event) ||
    event.projectId != null && scopedProjectIds.has(event.projectId));
  const scopedCalendar = calendar.filter((row) => STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) =>
    definitionMatchesStableInput(definition, `${row.title} ${row.location ?? ""}`)));
  const scopedPreviousToday = previousToday.filter((row) =>
    row.projectId != null && scopedProjectIds.has(row.projectId) ||
    STERLING_TODAY_ACCEPTANCE_SCOPE.some((definition) => definitionMatchesStableInput(definition, row.summary)));

  const projectEvidenceThreads = await loadSterlingProjectThreadIds(input.client as never, scopedProjects);
  const projectThreadIds = projectEvidenceThreads.trustedByProject;
  const trustedProjectThreads = [...new Set([...projectThreadIds.values()].flat())];
  const indexed = await expandSterlingIndexedThreadContext(
    input.client as never,
    await loadIndexedTodayThreadContext(scopedCandidates),
    [...trustedProjectThreads, ...projectEvidenceThreads.discoveryThreadIds, ...acceptanceThreadIds()],
  );
  const liveThreadOutcomes: TodayLiveThreadOutcome[] = [];
  let gmailDiagnostics: TodayLiveEnrichmentDiagnostics | null = null;
  const threadContext = await loadLiveTodayOperationalFacts(indexed, {
    ...(input.createGmailBatch ? { createBatch: input.createGmailBatch } : {}),
    onThreadOutcome: (outcome) => liveThreadOutcomes.push(outcome),
    onDiagnostics: (diagnostics) => { gmailDiagnostics = diagnostics; },
  });
  const workingSet = buildSterlingTodayWorkingSet({
    sourceWatermark: watermark,
    generatedAt: now.toISOString(),
    projects: scopedProjects,
    jobs: scopedJobs,
    candidates: scopedCandidates,
    threadContext,
    knownPeople: scopedPeople,
    founderCorrections: scopedCorrections,
    calendar: scopedCalendar,
    calendarAvailability: {
      status: calendarStatus.diagnosis === "live_read_eligible" ? "available"
        : calendarStatus.diagnosis === "read_disabled" ? "disabled" : "unavailable",
      reason: calendarStatus.diagnosis,
    },
    previousToday: scopedPreviousToday,
    projectThreadIds,
    explicitEvidenceGroups: STERLING_TODAY_ACCEPTANCE_SCOPE
      .filter((definition) => (definition.exactThreadIds?.length ?? 0) > 0)
      .map((definition) => ({ groupId: definition.key, label: definition.publicId,
        identifiers: definition.identifiers, threadIds: definition.exactThreadIds ?? [],
        jobIds: definition.exactJobIds ?? [] })),
  });
  const completeness = evaluateSterlingEvidenceCompleteness({ workingSet, threadOutcomes: liveThreadOutcomes });
  const coverage = scopeCoverage(workingSet, canonicalProjectIdsByKey);
  let requestWorkingSet = workingSet;
  let target: SterlingTodayAssembly["target"] = null;
  let targetBlockedReason: SterlingTodayAssembly["targetBlockedReason"] = null;
  let targetPackage: SterlingTodayAssembly["targetPackage"] = null;
  if (input.targetCase) {
    const definition = scopeDefinition(input.targetCase);
    if (!definition) throw new Error("sterling-target-unknown-case");
    const matching = matchingUnits(
      workingSet,
      definition,
      canonicalProjectIdsByKey.get(definition.key) ?? new Set<string>(),
    );
    const exact = matching.filter((unit) => scopeMatchesOperationalIdentifier(definition, unit.observedIdentifiers));
    const exactThread = matching.filter((unit) => (definition.exactThreadIds ?? []).some((threadId) => unit.threadIds.includes(threadId)));
    const canonical = matching.filter((unit) => unit.kind === "canonical_project");
    const selected = exact.length === 1 ? exact[0] : exactThread.length === 1 ? exactThread[0] : canonical.length === 1 ? canonical[0]
      : matching.length === 1 ? matching[0] : null;
    if (!selected) targetBlockedReason = matching.length === 0 ? "no-matching-work-unit" : "ambiguous-work-unit";
    else {
      requestWorkingSet = buildSterlingTodayTargetWorkingSet(workingSet, selected.workUnitId);
      target = { caseId: input.targetCase, selectedWorkUnitId: selected.workUnitId,
        relatedWorkUnitIds: matching.map((row) => row.workUnitId) };
      targetPackage = summarizeSterlingTodayTargetPackage(requestWorkingSet);
    }
  }
  const assemblyLatencyMs = Date.now() - startedAt;
  return {
    workingSet,
    requestWorkingSet,
    target,
    targetBlockedReason,
    targetPackage,
    completeness,
    scopeCoverage: coverage,
    calendar: { ...calendarStatus, todayItemsBeforeAcceptanceScope: calendar.length, scopedTodayItems: workingSet.calendar.length },
    gmail: gmailDiagnostics,
    counts: {
      people: workingSet.people.length,
      projects: workingSet.projects.length,
      jobs: workingSet.jobs.length,
      evidence: workingSet.evidence.length,
      workUnits: workingSet.workUnits.length,
      gmailThreads: threadContext.size,
      calendar: workingSet.calendar.length,
    },
    performance: {
      assemblyLatencyMs,
      serializedInputBytes: Buffer.byteLength(JSON.stringify(requestWorkingSet)),
      totalLatencyMs: Date.now() - startedAt,
    },
  };
}

export async function executeSterlingTodaySemantic(input: {
  assembly: SterlingTodayAssembly;
  apiKey: string;
  model?: string;
}): Promise<SterlingTodaySemanticCompletion> {
  const startedAt = Date.now();
  if (input.assembly.targetBlockedReason) {
    return blockedCompletion(input.assembly, "EVIDENCE_BLOCKED", startedAt);
  }
  const preview = buildSterlingEvidenceReadyWorkingSet({
    workingSet: input.assembly.requestWorkingSet,
    completeness: input.assembly.completeness,
  });
  if (!preview.workingSet) return blockedCompletion(input.assembly, "EVIDENCE_BLOCKED", startedAt);
  const gated = await executeSterlingEvidenceGatedRequest({
    workingSet: input.assembly.requestWorkingSet,
    completeness: input.assembly.completeness,
    request: (workingSet) => requestSterlingTodayProposal({
      apiKey: input.apiKey,
      model: input.model ?? conciergeForegroundModel(process.env.CONTINUUM_STERLING_TODAY_MODEL),
      workingSet,
    }),
  });
  if (!gated.called || !gated.workingSet || !gated.result) {
    return blockedCompletion(input.assembly, "EVIDENCE_BLOCKED", startedAt);
  }
  const validation = validateSterlingTodayProposal(gated.workingSet, gated.result.proposal);
  const acceptance = input.assembly.target ? null : evaluateSterlingTodayAcceptance(gated.workingSet, gated.result.proposal);
  const verdict = input.assembly.target
    ? validation.accepted ? "TARGET_VALID" : "BLOCK"
    : validation.accepted && acceptance?.passed && gated.blockedWorkUnitIds.length === 0 ? "PASS" : "BLOCK";
  return {
    assembly: input.assembly,
    called: true,
    blockedWorkUnitIds: gated.blockedWorkUnitIds,
    proposal: gated.result.proposal,
    validation,
    acceptance,
    verdict,
    performance: {
      ...input.assembly.performance,
      modelLatencyMs: gated.result.latencyMs,
      inputBytes: gated.result.inputBytes,
      outputBytes: gated.result.outputBytes,
      tokenUsage: gated.result.usage,
      totalLatencyMs: Date.now() - startedAt + input.assembly.performance.totalLatencyMs,
    },
  };
}

function blockedCompletion(
  assembly: SterlingTodayAssembly,
  verdict: "EVIDENCE_BLOCKED",
  startedAt: number,
): SterlingTodaySemanticCompletion {
  return {
    assembly,
    called: false,
    blockedWorkUnitIds: assembly.completeness.workUnits.filter((row) => !row.modelEligible).map((row) => row.workUnitId),
    proposal: null,
    validation: null,
    acceptance: null,
    verdict,
    performance: { ...assembly.performance, modelLatencyMs: null, inputBytes: null, outputBytes: null,
      tokenUsage: null, totalLatencyMs: Date.now() - startedAt + assembly.performance.totalLatencyMs },
  };
}

export function safeAssemblyResult(assembly: SterlingTodayAssembly): SterlingTodaySafeResult {
  const safeErrors = [...new Set([
    ...assembly.completeness.aggregate.safeErrorCategories,
    ...Object.keys(assembly.gmail?.failuresByCode ?? {}),
    ...(assembly.targetBlockedReason ? [assembly.targetBlockedReason] : []),
  ])].sort();
  return {
    ok: assembly.targetBlockedReason === null,
    mode: "assembly",
    verdict: "ASSEMBLY_ONLY",
    counts: assembly.counts,
    completeness: assembly.completeness.aggregate,
    scope: {
      total: assembly.scopeCoverage.length,
      resolved: assembly.scopeCoverage.filter((row) => row.resolved).length,
      unresolved: assembly.scopeCoverage.filter((row) => !row.resolved).length,
    },
    gmail: assembly.gmail ? {
      requestedThreadCount: assembly.gmail.requestedThreadCount,
      completedThreadCount: assembly.gmail.completedThreadCount,
      failedThreadCount: assembly.gmail.failedThreadCount,
      threadFetches: assembly.gmail.threadFetches,
      durationMs: assembly.gmail.durationMs,
      failuresByCode: assembly.gmail.failuresByCode,
    } : null,
    performance: { ...assembly.performance, modelLatencyMs: null, inputBytes: null, outputBytes: null, tokenUsage: null },
    validation: null,
    safeErrors,
  };
}

export function safeSemanticResult(completion: SterlingTodaySemanticCompletion): SterlingTodaySafeResult {
  const validation = completion.validation;
  return {
    ...safeAssemblyResult(completion.assembly),
    ok: completion.verdict === "PASS" || completion.verdict === "TARGET_VALID",
    mode: "semantic",
    verdict: completion.verdict,
    performance: completion.performance,
    validation: validation ? {
      accepted: validation.accepted,
      errorCount: validation.errors.length,
      mutationProposalCount: completion.proposal?.proposedCanonicalMutations.length ?? 0,
    } : null,
  };
}

export const STERLING_TODAY_SCOPE_IDENTIFIERS = acceptanceIdentifiers();
