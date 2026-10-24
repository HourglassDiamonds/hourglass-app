/** Read-only Sterling-native Today assembly and semantic orchestration. */
import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectPagedRows } from "@/lib/continuum/candidates/page";
import { rowToCandidate } from "@/lib/continuum/candidates/rows";
import { CONTINUUM_CANDIDATES_TABLE } from "@/lib/continuum/candidates/activation";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { SupabaseProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/supabase";
import { loadProjectJobs } from "@/lib/continuum/client-memory/project-jobs/load";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import { loadFounderCorrectionEvents } from "@/lib/continuum/chief-of-staff/operating-loop/founder-corrections-load";
import {
  loadIndexedTodayThreadContext,
  loadIndexedTodayThreadContextByEmailHashes,
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
import { evaluateOctober21Acceptance } from "./october-19-acceptance";
import { expandSterlingIndexedThreadContext, loadSterlingProjectThreadIds } from "./evidence-load";
import { buildSterlingTodayTargetWorkingSet, summarizeSterlingTodayTargetPackage } from "./target";
import { createSterlingEvidenceHandleMap } from "./evidence-handles";
import { resolveSterlingTarget } from "./target-resolution";
import { finalizeSterlingGmailExecution, STERLING_GMAIL_REQUEST_BUDGET } from "./retrieval-execution";
import { excludeSterlingSuppressedWorkUnits, sterlingPreModelSuppressions,
  type SterlingPreModelSuppressionReason } from "./pre-model-suppression";
import { selectSterlingPortfolio } from "./portfolio-scope";
import {
  planSterlingThreadVerificationContinuity,
  sterlingIndexedThreadFingerprint,
  sterlingThreadKeyDigest,
  STERLING_THREAD_VERIFICATION_MAX_AGE_MS,
  type SterlingThreadVerificationMetadata,
} from "./retrieval-continuity";
import type { SterlingThreadVerificationStore } from "./retrieval-continuity-store";
import {
  buildSterlingEvidenceReadyWorkingSet,
  collectSterlingRequiredLiveThreadIds,
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
import type { SarahSemanticPackageDiagnostics } from "./sarah-semantic";
import {
  diagnoseSterlingTargetChronology,
  sterlingTargetChronologyFailureStage,
  type SterlingTargetChronologyDiagnostics,
} from "./target-chronology";
import {
  STERLING_TODAY_ACCEPTANCE_SCOPE,
  acceptanceIdentifiers,
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
  resolution: "exact_identifier" | "exact_thread_scope" | "exact_source_record" | "canonical_project" | "founder_correction" | "unresolved";
  workUnitIds: readonly string[];
};

export type SterlingTargetStoppedAtStage =
  | "target-resolution-failed"
  | "target-thread-live-retrieval-incomplete"
  | "target-evidence-binding-incomplete"
  | "target-chronology-incomplete"
  | "target-package-oversized"
  | "target-package-cross-unit-evidence"
  | null;

export type SterlingTodayAssembly = {
  workingSet: SterlingTodayWorkingSet;
  requestWorkingSet: SterlingTodayWorkingSet;
  target: { caseId: string; selectedWorkUnitId: string; relatedWorkUnitIds: readonly string[] } | null;
  targetBlockedReason: "no-matching-work-unit" | "ambiguous-work-unit" |
    "target-required-evidence-exceeds-budget" | "target-required-evidence-missing" |
    "target-required-evidence-incomplete" | null;
  targetDiagnostics: null | {
    selectedWorkUnitId: string | null;
    secondaryWorkUnitIds: readonly string[];
    requiredThreadCount: number;
    scheduledThreadCount: number;
    successfullyLiveRetrievedThreadCount: number;
    missingOrFailedThreadCount: number;
    providerFailedThreadCount: number;
    budgetDeferredThreadCount: number;
    requiredIndexedMessageCount: number;
    successfullyLiveRetrievedMessageCount: number;
    includedEvidenceMessageCount: number;
    excludedOrAmbiguousAssociationCount: number;
    stoppedAtStage: SterlingTargetStoppedAtStage;
    latestVerifiedSourceAt: string | null;
    chronologyInvariant: SterlingTargetChronologyDiagnostics | null;
    complete: boolean;
  };
  targetPackage: ReturnType<typeof summarizeSterlingTodayTargetPackage> | null;
  completeness: SterlingEvidenceCompletenessReport;
  scopeCoverage: readonly SterlingScopeCoverage[];
  calendar: SterlingCalendarDiagnostic & { todayItemsBeforeAcceptanceScope: number; scopedTodayItems: number };
  gmail: SterlingGmailDiagnostics | null;
  continuity: SterlingContinuityDiagnostics;
  counts: { people: number; projects: number; jobs: number; evidence: number; workUnits: number; gmailThreads: number; calendar: number };
  candidateCoverage: ReturnType<typeof selectSterlingPortfolio>["candidateCoverage"];
  suppressionByWorkUnitId: Readonly<Record<string, SterlingPreModelSuppressionReason>>;
  performance: { assemblyLatencyMs: number; serializedInputBytes: number; totalLatencyMs: number };
};

export type SterlingGmailDiagnostics = TodayLiveEnrichmentDiagnostics & {
  requiredThreadCount: number;
  scheduledThreadCount: number;
};

export type SterlingContinuityDiagnostics = {
  status: "disabled" | "available" | "degraded" | "unavailable";
  requiredThreadCount: number;
  reusedVerificationCount: number;
  expiredVerificationCount: number;
  invalidatedVerificationCount: number;
  persistedVerificationCount: number;
  persistenceConflictCount: number;
  persistenceFailureCount: number;
  semanticEvidenceReusable: false;
};

export type SterlingTodaySemanticCompletion = {
  assembly: SterlingTodayAssembly;
  called: boolean;
  blockedWorkUnitIds: readonly string[];
  proposal: SterlingTodayProposal | null;
  validation: SterlingTodayValidationResult | null;
  acceptance: ReturnType<typeof evaluateSterlingTodayAcceptance> | null;
  operationalAcceptance: ReturnType<typeof evaluateOctober21Acceptance> | null;
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
  mode: "assembly" | "package_preflight" | "semantic";
  verdict: SterlingTodaySemanticCompletion["verdict"] | "ASSEMBLY_ONLY" | "PACKAGE_READY" |
    "PACKAGE_BLOCKED" | "UNAVAILABLE" | "DISABLED" | "BUSY";
  counts: SterlingTodayAssembly["counts"] | null;
  completeness: SterlingEvidenceCompletenessReport["aggregate"] | null;
  scope: { total: number; resolved: number; unresolved: number } | null;
  workUnitCoverage: readonly SterlingSafeWorkUnitCoverage[];
  namedCaseCoverage: readonly SterlingSafeNamedCaseCoverage[];
  target: null | {
    selectedWorkUnitRef: string | null;
    secondaryWorkUnitRefs: readonly string[];
    requiredThreadCount: number;
    scheduledThreadCount: number;
    successfullyLiveRetrievedThreadCount: number;
    missingOrFailedThreadCount: number;
    providerFailedThreadCount: number;
    budgetDeferredThreadCount: number;
    requiredIndexedMessageCount: number;
    successfullyLiveRetrievedMessageCount: number;
    includedEvidenceMessageCount: number;
    excludedOrAmbiguousAssociationCount: number;
    stoppedAtStage: SterlingTargetStoppedAtStage;
    latestVerifiedSourceAt: string | null;
    chronologyInvariant: SterlingTargetChronologyDiagnostics | null;
    complete: boolean;
  };
  candidateCoverage: SterlingTodayAssembly["candidateCoverage"] | null;
  continuity: SterlingContinuityDiagnostics | null;
  gmail: null | Pick<SterlingGmailDiagnostics, "requiredThreadCount" | "scheduledThreadCount" |
    "requestedThreadCount" | "completedThreadCount" | "failedThreadCount" |
    "providerRateLimitedThreadCount" | "otherProviderErrorThreadCount" | "missingIndexedThreadCount" |
    "budgetDeferredThreadCount" | "threadFetches" | "durationMs" | "failuresByCode">;
  performance: null | SterlingTodaySemanticCompletion["performance"];
  packagePreflight: SarahSemanticPackageDiagnostics | null;
  validation: null | { accepted: boolean; errorCount: number; mutationProposalCount: number };
  proposal: SterlingSafeSemanticProposal | null;
  acceptance: null | {
    originalTenPassed: boolean;
    october21Passed: boolean;
    passCount: number;
    failCount: number;
    unverifiedCount: number;
  };
  safeErrors: readonly string[];
};

export type SterlingSafeSemanticProposal = {
  assessments: readonly {
    workUnitRef: string;
    canonicalLifecycleStage: string | null;
    operationalSubstage: string | null;
    nextStepOwner: string;
    confidence: string;
    explanation: string;
    citations: readonly string[];
    ambiguities: readonly string[];
    obligations: readonly {
      description: string;
      status: string;
      responsibleParty: string;
      confidence: string;
      citations: readonly string[];
    }[];
  }[];
  recommendations: readonly {
    title: string;
    summary: string;
    confidence: string;
    explanation: string;
    citations: readonly string[];
    ambiguities: readonly string[];
  }[];
  portfolioAmbiguities: readonly string[];
  mutationProposalCount: number;
};

export type SterlingSafeWorkUnitCoverage = {
  workUnitRef: string;
  classification: "canonical" | "provisional";
  recordIdentifier: string | null;
  evidenceStatus: SterlingEvidenceCompletenessReport["workUnits"][number]["status"];
  modelEligible: boolean;
  requiredThreadCount: number;
  missingExactThreadCount: number;
  providerFailedThreadCount: number;
  providerRateLimitedThreadCount: number;
  otherProviderErrorThreadCount: number;
  budgetDeferredThreadCount: number;
  missingIndexedThreadCount: number;
  indexedOnlyThreadCount: number;
  latestIndexedEvidenceAt: string | null;
  latestLiveVerifiedEvidenceAt: string | null;
  lastSuccessfulVerificationAt: string | null;
  reusedVerificationThreadCount: number;
  blockReason: string | null;
  suppressionReason: string | null;
};

export type SterlingSafeNamedCaseCoverage = {
  caseId: string;
  resolved: boolean;
  resolution: SterlingScopeCoverage["resolution"];
  workUnitRefs: readonly string[];
  evidenceStatus: "eligible" | "blocked" | "unresolved";
  blockReasons: readonly string[];
};

type AssembleInput = {
  client: SupabaseClient;
  now?: Date;
  targetCase?: string | null;
  liveRetrievalScope?: "portfolio" | "target_only";
  expectedTargetThreadIds?: readonly string[];
  createGmailBatch?: () => Promise<LiveSourceViewerBatch | null>;
  continuity?: {
    mode: "assembly_planning_only";
    hmacKey: string;
    store: SterlingThreadVerificationStore;
  };
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

function matchingUnits(
  workingSet: SterlingTodayWorkingSet,
  definition: SterlingTodayScopeDefinition,
  canonicalProjectIds: ReadonlySet<string>,
) {
  const evidence = new Map(workingSet.evidence.map((row) => [row.evidenceId, row]));
  return workingSet.workUnits.filter((unit) => {
    if ((definition.exactThreadIds ?? []).some((threadId) => unit.threadIds.includes(threadId))) return true;
    if ((definition.exactJobIds ?? []).some((jobId) => unit.evidenceRefs.includes(`canonical:job:${jobId}`))) return true;
    if (scopeMatchesOperationalIdentifier(definition, unit.observedIdentifiers)) return true;
    if (unit.projectId && canonicalProjectIds.has(unit.projectId)) return true;
    if (definition.founderCorrectionOnly) {
      return unit.evidenceRefs.some((ref) => {
        const row = evidence.get(ref);
        return row?.sourceType === "founder_directive" && row.sourceRef.startsWith("founder-note:") &&
          scopeMatchesText(definition, `${unit.label} ${row.excerpt ?? ""}`);
      });
    }
    return false;
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
    const exactSourceRecord = units.filter((unit) => (definition.exactJobIds ?? [])
      .some((jobId) => unit.evidenceRefs.includes(`canonical:job:${jobId}`)));
    const founderCorrection = units.filter((unit) => unit.evidenceRefs.some((ref) => {
      const evidence = workingSet.evidence.find((row) => row.evidenceId === ref);
      return evidence?.sourceType === "founder_directive" && evidence.sourceRef.startsWith("founder-note:");
    }));
    const canonical = units.filter((unit) => unit.kind === "canonical_project");
    const selected = exact.length === 1 ? exact : exactThread.length === 1 ? exactThread : exactSourceRecord.length === 1 ? exactSourceRecord
      : founderCorrection.length === 1 ? founderCorrection
      : canonical.length === 1 ? canonical : [];
    return {
      publicId: definition.publicId,
      resolved: selected.length === 1,
      resolution: exact.length === 1 ? "exact_identifier"
        : exactThread.length === 1 ? "exact_thread_scope"
          : exactSourceRecord.length === 1 ? "exact_source_record"
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

  const portfolio = selectSterlingPortfolio(
    { projects, jobs: jobs ?? [], candidates, corrections, calendar, previousToday },
    now.toISOString(),
  );
  const canonicalProjectIdsByKey = new Map<string, ReadonlySet<string>>(
    STERLING_TODAY_ACCEPTANCE_SCOPE.map((definition) => [definition.key, new Set([
      ...portfolio.projects.filter((project) => scopeMatchesIdentifierText(definition, projectText(project)))
        .map((project) => project.projectId),
      ...portfolio.projects.filter((project) => (definition.exactProjectIds ?? []).includes(project.projectId))
        .map((project) => project.projectId),
      ...portfolio.corrections.filter((event) => isDurablyScopedFounderCorrection(definition, event))
        .flatMap((event) => event.projectId ? [event.projectId] : []),
    ])]),
  );

  const projectEvidenceThreads = await loadSterlingProjectThreadIds(input.client as never, portfolio.projects);
  const projectThreadIds = projectEvidenceThreads.trustedByProject;
  const trustedProjectThreads = [...new Set([...projectThreadIds.values()].flat())];
  const activeProjectlessJobs = portfolio.jobs.filter((job) =>
    job.projectId === null && (job.state === "open" || job.state === "snoozed") && job.associatedPersonId);
  const activeProjectlessPersonIds = new Set(activeProjectlessJobs.flatMap((job) => job.associatedPersonId ? [job.associatedPersonId] : []));
  const boundedIdentitySince = new Date(Math.max(
    now.getTime() - 90 * 86_400_000,
    Math.min(...activeProjectlessJobs.map((job) => Date.parse(job.createdAt)).filter(Number.isFinite), now.getTime()),
  )).toISOString();
  const projectlessIdentityContext = await loadIndexedTodayThreadContextByEmailHashes(
    people.filter((person) => activeProjectlessPersonIds.has(person.personId)).map((person) => person.emailHash),
    { client: input.client as never, sinceIso: boundedIdentitySince },
  );
  const candidateContext = await loadIndexedTodayThreadContext(portfolio.candidates, { client: input.client as never });
  for (const [threadId, context] of projectlessIdentityContext) {
    if (!candidateContext.has(threadId)) candidateContext.set(threadId, context);
  }
  const indexed = await expandSterlingIndexedThreadContext(
    input.client as never,
    candidateContext,
    [...trustedProjectThreads, ...projectEvidenceThreads.discoveryThreadIds],
  );
  const indexedEmailHashes = new Set([...indexed.values()].flatMap((thread) =>
    (thread.messages ?? []).flatMap((message) => {
      const hash = message.fromEmailHash?.trim().toLowerCase();
      return hash ? [hash] : [];
    })));
  const preliminaryPersonIds = new Set([
    ...portfolio.projects.flatMap((project) => project.people.map((person) => person.personId)),
    ...people.filter((person) => indexedEmailHashes.has(person.emailHash.toLowerCase())).map((person) => person.personId),
  ]);
  const preliminaryWorkingSet = buildSterlingTodayWorkingSet({
    sourceWatermark: watermark,
    generatedAt: now.toISOString(),
    projects: portfolio.projects,
    jobs: portfolio.jobs,
    candidates: portfolio.candidates,
    threadContext: indexed,
    knownPeople: people.filter((person) => preliminaryPersonIds.has(person.personId)),
    founderCorrections: portfolio.corrections,
    calendar: portfolio.calendar,
    calendarAvailability: {
      status: calendarStatus.diagnosis === "live_read_eligible" ? "available"
        : calendarStatus.diagnosis === "read_disabled" ? "disabled" : "unavailable",
      reason: calendarStatus.diagnosis,
    },
    previousToday: portfolio.previousToday,
    projectThreadIds,
  });
  const requiredLiveThreadIds = collectSterlingRequiredLiveThreadIds(preliminaryWorkingSet);
  const targetDefinitionForPlanning = input.targetCase ? scopeDefinition(input.targetCase) : null;
  const targetUnitsForPlanning = targetDefinitionForPlanning ? matchingUnits(
    preliminaryWorkingSet,
    targetDefinitionForPlanning,
    canonicalProjectIdsByKey.get(targetDefinitionForPlanning.key) ?? new Set<string>(),
  ) : [];
  const preliminaryTargetResolution = targetDefinitionForPlanning ? resolveSterlingTarget({
    workingSet: preliminaryWorkingSet,
    definition: targetDefinitionForPlanning,
    matchingUnits: targetUnitsForPlanning,
    canonicalProjectIds: canonicalProjectIdsByKey.get(targetDefinitionForPlanning.key) ?? new Set<string>(),
  }) : null;
  const targetThreadIdsForPlanning = preliminaryTargetResolution && preliminaryTargetResolution.blockedReason === null
    ? [...preliminaryTargetResolution.requiredThreadIds] : [];
  const expectedTargetThreadIds = [...new Set(input.expectedTargetThreadIds ?? [])].sort();
  const actualTargetThreadIds = [...targetThreadIdsForPlanning].sort();
  const targetOnlyScopeInvalid = input.liveRetrievalScope === "target_only" && (
    !input.targetCase || expectedTargetThreadIds.length === 0 ||
    expectedTargetThreadIds.length !== actualTargetThreadIds.length ||
    expectedTargetThreadIds.some((threadId, index) => threadId !== actualTargetThreadIds[index])
  );
  const targetPlanningSet = new Set(targetThreadIdsForPlanning);
  const prioritizedRequiredLiveThreadIds = [
    ...targetThreadIdsForPlanning,
    ...requiredLiveThreadIds.filter((threadId) => !targetPlanningSet.has(threadId)),
  ];
  const liveThreadOutcomes: TodayLiveThreadOutcome[] = [];
  let continuity: SterlingContinuityDiagnostics = {
    status: input.continuity ? "unavailable" : "disabled",
    requiredThreadCount: requiredLiveThreadIds.length,
    reusedVerificationCount: 0,
    expiredVerificationCount: 0,
    invalidatedVerificationCount: 0,
    persistedVerificationCount: 0,
    persistenceConflictCount: 0,
    persistenceFailureCount: 0,
    semanticEvidenceReusable: false,
  };
  const retrievalBlocked = Boolean(preliminaryTargetResolution?.blockedReason) || targetOnlyScopeInvalid;
  let selectedLiveThreadIds = retrievalBlocked ? [] : input.liveRetrievalScope === "target_only"
    ? targetThreadIdsForPlanning : prioritizedRequiredLiveThreadIds.slice(0, STERLING_GMAIL_REQUEST_BUDGET);
  let budgetDeferredThreadIds = retrievalBlocked ? [] : input.liveRetrievalScope === "target_only"
    ? requiredLiveThreadIds.filter((threadId) => !targetPlanningSet.has(threadId))
    : prioritizedRequiredLiveThreadIds.slice(STERLING_GMAIL_REQUEST_BUDGET);
  let priorVerifications = new Map<string, SterlingThreadVerificationMetadata>();
  if (input.continuity && !retrievalBlocked && input.liveRetrievalScope !== "target_only") {
    try {
      const digests = requiredLiveThreadIds.map((threadId) =>
        sterlingThreadKeyDigest(threadId, input.continuity!.hmacKey));
      const loaded = await input.continuity.store.load(digests);
      if (loaded.available) {
        priorVerifications = new Map(loaded.rows.map((row) => [row.threadKeyDigest, row]));
        const plan = planSterlingThreadVerificationContinuity({
          workingSet: preliminaryWorkingSet,
          priorVerifications: loaded.rows,
          threadKeyHmacKey: input.continuity.hmacKey,
          priorityThreadIds: targetThreadIdsForPlanning,
          forceLiveThreadIds: targetThreadIdsForPlanning,
        });
        selectedLiveThreadIds = [...plan.liveRequestThreadIds];
        budgetDeferredThreadIds = [...plan.budgetDeferredThreadIds];
        continuity = {
          ...continuity,
          status: "available",
          reusedVerificationCount: plan.reusableVerificationCount,
          expiredVerificationCount: plan.expiredVerificationCount,
          invalidatedVerificationCount: plan.invalidatedVerificationCount,
        };
        for (const threadId of plan.reusedVerificationThreadIds) {
          const current = sterlingIndexedThreadFingerprint(preliminaryWorkingSet, threadId);
          const prior = priorVerifications.get(sterlingThreadKeyDigest(threadId, input.continuity.hmacKey));
          liveThreadOutcomes.push({
            threadId,
            status: "indexed_excerpt_only",
            indexedMessageCount: current.indexedMessageCount,
            liveMessageCount: 0,
            safeErrorCategory: "recently-verified-assembly-only",
            latestIndexedMessageAt: current.latestIndexedMessageAt,
            latestLiveMessageAt: prior?.latestIndexedMessageAt ?? null,
            verifiedAt: prior?.verifiedAt ?? null,
          });
        }
      }
    } catch {
      // Fail closed: no checkpoint is trusted and the normal bounded live frontier is used.
      continuity = { ...continuity, status: "unavailable" };
      selectedLiveThreadIds = prioritizedRequiredLiveThreadIds.slice(0, STERLING_GMAIL_REQUEST_BUDGET);
      budgetDeferredThreadIds = prioritizedRequiredLiveThreadIds.slice(STERLING_GMAIL_REQUEST_BUDGET);
      priorVerifications = new Map();
    }
  }
  const execution = finalizeSterlingGmailExecution({
    selectedLiveThreadIds,
    budgetDeferredThreadIds,
    targetThreadIds: targetOnlyScopeInvalid ? [] : targetThreadIdsForPlanning,
    requestBudget: STERLING_GMAIL_REQUEST_BUDGET,
  });
  for (const threadId of execution.budgetDeferredThreadIds) {
    const current = sterlingIndexedThreadFingerprint(preliminaryWorkingSet, threadId);
    liveThreadOutcomes.push({
      threadId,
      status: "unavailable",
      indexedMessageCount: current.indexedMessageCount,
      liveMessageCount: 0,
      safeErrorCategory: "not-requested-budget-exhausted",
      latestIndexedMessageAt: current.latestIndexedMessageAt,
      latestLiveMessageAt: null,
    });
  }
  const loaderDiagnostics: { value: TodayLiveEnrichmentDiagnostics | null } = { value: null };
  const threadContext = retrievalBlocked ? indexed
    : await loadLiveTodayOperationalFacts(indexed, {
      threadIds: execution.scheduledThreadIds,
      preserveThreadOrder: true,
      maxThreadFetches: input.liveRetrievalScope === "target_only"
        ? execution.scheduledThreadIds.length : STERLING_GMAIL_REQUEST_BUDGET,
      ...(input.createGmailBatch ? { createBatch: input.createGmailBatch } : {}),
      onThreadOutcome: (outcome) => liveThreadOutcomes.push(outcome),
      onDiagnostics: (diagnostics) => { loaderDiagnostics.value = diagnostics; },
    });
  const rawGmailDiagnostics = loaderDiagnostics.value;
  const gmailDiagnostics: SterlingGmailDiagnostics | null = rawGmailDiagnostics ? {
    ...rawGmailDiagnostics,
    requiredThreadCount: requiredLiveThreadIds.length,
    scheduledThreadCount: execution.scheduledThreadIds.length,
    budgetDeferredThreadCount: execution.budgetDeferredThreadIds.length,
  } : null;
  if (input.continuity && continuity.status === "available") {
    const verifiedAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(verifiedAt) + STERLING_THREAD_VERIFICATION_MAX_AGE_MS).toISOString();
    for (const outcome of liveThreadOutcomes.filter((row) => row.status === "complete_live")) {
      outcome.verifiedAt = verifiedAt;
      const current = sterlingIndexedThreadFingerprint(preliminaryWorkingSet, outcome.threadId);
      const threadKeyDigest = sterlingThreadKeyDigest(outcome.threadId, input.continuity.hmacKey);
      const prior = priorVerifications.get(threadKeyDigest);
      const save = await input.continuity.store.save({
        threadKeyDigest,
        indexedFingerprint: current.fingerprint,
        verifiedAt,
        expiresAt,
        latestIndexedMessageAt: current.latestIndexedMessageAt,
        indexedMessageCount: current.indexedMessageCount,
        outcome: "complete_live",
        revision: prior?.revision ?? 1,
      }, prior?.revision ?? null);
      if (save === "stored") continuity.persistedVerificationCount += 1;
      else if (save === "conflict") continuity.persistenceConflictCount += 1;
      else continuity.persistenceFailureCount += 1;
    }
    if (continuity.persistenceFailureCount > 0 || continuity.persistenceConflictCount > 0) {
      continuity.status = "degraded";
    }
  }
  const referencedEmailHashes = new Set([...threadContext.values()].flatMap((thread) =>
    (thread.messages ?? []).flatMap((message) => {
      const hash = message.fromEmailHash?.trim().toLowerCase();
      return hash ? [hash] : [];
    })));
  const relevantPersonIds = new Set([
    ...portfolio.projects.flatMap((project) => project.people.map((person) => person.personId)),
    ...people.filter((person) => referencedEmailHashes.has(person.emailHash.toLowerCase()))
      .map((person) => person.personId),
  ]);
  const portfolioPeople = people.filter((person) => relevantPersonIds.has(person.personId));
  const workingSet = buildSterlingTodayWorkingSet({
    sourceWatermark: watermark,
    generatedAt: now.toISOString(),
    projects: portfolio.projects,
    jobs: portfolio.jobs,
    candidates: portfolio.candidates,
    threadContext,
    knownPeople: portfolioPeople,
    founderCorrections: portfolio.corrections,
    calendar: portfolio.calendar,
    calendarAvailability: {
      status: calendarStatus.diagnosis === "live_read_eligible" ? "available"
        : calendarStatus.diagnosis === "read_disabled" ? "disabled" : "unavailable",
      reason: calendarStatus.diagnosis,
    },
    previousToday: portfolio.previousToday,
    projectThreadIds,
  });
  const completeness = evaluateSterlingEvidenceCompleteness({ workingSet, threadOutcomes: liveThreadOutcomes });
  const coverage = scopeCoverage(workingSet, canonicalProjectIdsByKey);
  const suppressionByWorkUnitId = sterlingPreModelSuppressions(workingSet, now);
  let requestWorkingSet = excludeSterlingSuppressedWorkUnits(workingSet, suppressionByWorkUnitId);
  let target: SterlingTodayAssembly["target"] = null;
  let targetBlockedReason: SterlingTodayAssembly["targetBlockedReason"] = null;
  let targetDiagnostics: SterlingTodayAssembly["targetDiagnostics"] = null;
  let targetPackage: SterlingTodayAssembly["targetPackage"] = null;
  if (input.targetCase) {
    const definition = scopeDefinition(input.targetCase);
    if (!definition) throw new Error("sterling-target-unknown-case");
    const matching = matchingUnits(
      workingSet,
      definition,
      canonicalProjectIdsByKey.get(definition.key) ?? new Set<string>(),
    );
    const resolution = resolveSterlingTarget({ workingSet, definition, matchingUnits: matching,
      canonicalProjectIds: canonicalProjectIdsByKey.get(definition.key) ?? new Set<string>() });
    const selected = resolution.selected;
    targetBlockedReason = preliminaryTargetResolution?.blockedReason ??
      (targetOnlyScopeInvalid ? "target-required-evidence-missing" : resolution.blockedReason);
    const targetOutcomes = resolution.requiredThreadIds.map((threadId) =>
      liveThreadOutcomes.find((outcome) => outcome.threadId === threadId));
    const successful = targetOutcomes.filter((outcome) => outcome?.status === "complete_live").length;
    const scheduled = resolution.requiredThreadIds.filter((threadId) =>
      execution.scheduledThreadIds.includes(threadId)).length;
    const latestVerifiedSourceAt = targetOutcomes
      .flatMap((outcome) => outcome?.status === "complete_live" && outcome.latestLiveMessageAt
        ? [outcome.latestLiveMessageAt] : [])
      .sort().at(-1) ?? null;
    if (!targetBlockedReason && successful !== resolution.requiredThreadIds.length) {
      targetBlockedReason = "target-required-evidence-incomplete";
    }
    const providerFailedThreadCount = targetOutcomes.filter((outcome) =>
      outcome?.status === "unavailable" && outcome.safeErrorCategory !== "not-requested-budget-exhausted" &&
      outcome.safeErrorCategory !== "missing-indexed-context").length;
    const budgetDeferredThreadCount = targetOutcomes.filter((outcome) =>
      outcome?.safeErrorCategory === "not-requested-budget-exhausted").length;
    const requiredIndexedMessageCount = targetOutcomes.reduce((total, outcome) =>
      total + (outcome?.indexedMessageCount ?? 0), 0);
    const successfullyLiveRetrievedMessageCount = targetOutcomes.reduce((total, outcome) =>
      total + (outcome?.status === "complete_live" ? outcome.liveMessageCount : 0), 0);
    let stoppedAtStage: NonNullable<SterlingTodayAssembly["targetDiagnostics"]>["stoppedAtStage"] =
      targetBlockedReason ? (targetBlockedReason === "target-required-evidence-incomplete"
        ? "target-thread-live-retrieval-incomplete" : "target-resolution-failed") : null;
    let includedEvidenceMessageCount = 0;
    let chronologyInvariant: SterlingTargetChronologyDiagnostics | null = null;
    let requestTargetWorkingSet: SterlingTodayWorkingSet | null = null;
    if (selected) {
      requestTargetWorkingSet = buildSterlingTodayTargetWorkingSet(workingSet, selected.workUnitId, {
        reviewedRequiredThreadIds: resolution.requiredThreadIds,
      });
      const requiredThreadSet = new Set(resolution.requiredThreadIds);
      const packageGmailEvidence = requestTargetWorkingSet.evidence.filter((row) => row.sourceType === "gmail");
      includedEvidenceMessageCount = packageGmailEvidence.filter((row) =>
        row.threadId != null && requiredThreadSet.has(row.threadId)).length;
      const packageUnit = requestTargetWorkingSet.workUnits[0];
      const bindingComplete = resolution.requiredThreadIds.every((threadId) =>
        packageUnit?.targetThreadBindings?.some((binding) => binding.threadId === threadId) &&
        packageGmailEvidence.some((row) => row.threadId === threadId));
      const crossUnitEvidence = packageGmailEvidence.some((row) =>
        row.threadId == null || !requiredThreadSet.has(row.threadId));
      chronologyInvariant = diagnoseSterlingTargetChronology({
        evidence: packageGmailEvidence,
        requiredThreadIds: resolution.requiredThreadIds,
        referencedEvidenceIds: packageUnit?.evidenceRefs ?? [],
        indexedMessageCount: requiredIndexedMessageCount,
        liveMessageCount: successfullyLiveRetrievedMessageCount,
        includedMessageCount: includedEvidenceMessageCount,
      });
      const chronologyFailureStage = sterlingTargetChronologyFailureStage(chronologyInvariant);
      if (!stoppedAtStage && crossUnitEvidence) stoppedAtStage = "target-package-cross-unit-evidence";
      else if (!stoppedAtStage && !bindingComplete) stoppedAtStage = "target-evidence-binding-incomplete";
      else if (!stoppedAtStage && chronologyFailureStage) stoppedAtStage = chronologyFailureStage;
      if (stoppedAtStage) targetBlockedReason ??= "target-required-evidence-incomplete";
    }
    targetDiagnostics = {
      selectedWorkUnitId: selected?.workUnitId ?? null,
      secondaryWorkUnitIds: resolution.secondary.map((unit) => unit.workUnitId),
      requiredThreadCount: resolution.requiredThreadIds.length,
      scheduledThreadCount: scheduled,
      successfullyLiveRetrievedThreadCount: successful,
      missingOrFailedThreadCount: resolution.requiredThreadIds.length - successful,
      providerFailedThreadCount,
      budgetDeferredThreadCount,
      requiredIndexedMessageCount,
      successfullyLiveRetrievedMessageCount,
      includedEvidenceMessageCount,
      excludedOrAmbiguousAssociationCount: resolution.secondary.length,
      stoppedAtStage,
      latestVerifiedSourceAt,
      chronologyInvariant,
      complete: targetBlockedReason === null,
    };
    if (selected) {
      requestWorkingSet = requestTargetWorkingSet!;
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
    targetDiagnostics,
    targetPackage,
    completeness,
    scopeCoverage: coverage,
    calendar: { ...calendarStatus, todayItemsBeforeAcceptanceScope: calendar.length, scopedTodayItems: workingSet.calendar.length },
    gmail: gmailDiagnostics,
    continuity,
    candidateCoverage: portfolio.candidateCoverage,
    suppressionByWorkUnitId,
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
  requestPolicy?: {
    maxOutputTokens: number;
    maxRequestBytes: number;
    disableTruncation: true;
  };
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
      ...input.requestPolicy,
    }),
  });
  if (!gated.called || !gated.workingSet || !gated.result) {
    return blockedCompletion(input.assembly, "EVIDENCE_BLOCKED", startedAt);
  }
  const validation = validateSterlingTodayProposal(gated.workingSet, gated.result.proposal);
  const acceptance = input.assembly.target ? null : evaluateSterlingTodayAcceptance(gated.workingSet, gated.result.proposal);
  const operationalAcceptance = input.assembly.target ? null : evaluateOctober21Acceptance(gated.workingSet, gated.result.proposal);
  const verdict = input.assembly.target
    ? validation.accepted ? "TARGET_VALID" : "BLOCK"
    : validation.accepted && acceptance?.passed && operationalAcceptance?.passed && gated.blockedWorkUnitIds.length === 0
      ? "PASS" : "BLOCK";
  return {
    assembly: input.assembly,
    called: true,
    blockedWorkUnitIds: gated.blockedWorkUnitIds,
    proposal: gated.result.proposal,
    validation,
    acceptance,
    operationalAcceptance,
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
    validation: null,
    proposal: null,
    acceptance: null,
    operationalAcceptance: null,
    verdict,
    performance: { ...assembly.performance, modelLatencyMs: null, inputBytes: null, outputBytes: null,
      tokenUsage: null, totalLatencyMs: Date.now() - startedAt + assembly.performance.totalLatencyMs },
  };
}

function opaqueWorkUnitRef(workUnitId: string): string {
  return `wu_${createHash("sha256").update(workUnitId).digest("hex").slice(0, 16)}`;
}

function safeRecordIdentifier(unit: SterlingTodayWorkingSet["workUnits"][number]): string | null {
  return unit.typedIdentifiers.find((row) => row.kind === "project" || row.kind === "request")?.value ?? null;
}

function safeWorkUnitCoverage(assembly: SterlingTodayAssembly): SterlingSafeWorkUnitCoverage[] {
  const units = new Map(assembly.workingSet.workUnits.map((unit) => [unit.workUnitId, unit]));
  return assembly.completeness.workUnits.flatMap((row) => {
    const unit = units.get(row.workUnitId);
    if (!unit) return [];
    const suppressionReason = assembly.suppressionByWorkUnitId[row.workUnitId] ?? null;
    return [{
      workUnitRef: opaqueWorkUnitRef(row.workUnitId),
      classification: unit.kind === "canonical_project" ? "canonical" as const : "provisional" as const,
      recordIdentifier: safeRecordIdentifier(unit),
      evidenceStatus: row.status,
      modelEligible: row.modelEligible && suppressionReason === null,
      requiredThreadCount: row.requiredThreadCount,
      missingExactThreadCount: row.missingExactThreadCount,
      providerFailedThreadCount: row.providerFailedThreadCount,
      providerRateLimitedThreadCount: row.providerRateLimitedThreadCount,
      otherProviderErrorThreadCount: row.otherProviderErrorThreadCount,
      budgetDeferredThreadCount: row.budgetDeferredThreadCount,
      missingIndexedThreadCount: row.missingIndexedThreadCount,
      indexedOnlyThreadCount: row.indexedOnlyThreadCount,
      latestIndexedEvidenceAt: row.latestIndexedEvidenceAt,
      latestLiveVerifiedEvidenceAt: row.latestLiveVerifiedEvidenceAt,
      lastSuccessfulVerificationAt: row.lastSuccessfulVerificationAt,
      reusedVerificationThreadCount: row.reusedVerificationThreadCount,
      blockReason: row.blockReason,
      suppressionReason,
    }];
  }).sort((a, b) => a.workUnitRef.localeCompare(b.workUnitRef));
}

function safeNamedCaseCoverage(assembly: SterlingTodayAssembly): SterlingSafeNamedCaseCoverage[] {
  const completeness = new Map(assembly.completeness.workUnits.map((row) => [row.workUnitId, row]));
  return assembly.scopeCoverage.map((row) => {
    const matches = row.workUnitIds.flatMap((workUnitId) => {
      const result = completeness.get(workUnitId);
      return result ? [result] : [];
    });
    const selectedTargetId = assembly.target?.caseId === row.publicId ? assembly.target.selectedWorkUnitId : null;
    const effectiveMatches = selectedTargetId ? matches.filter((match) => match.workUnitId === selectedTargetId) : matches;
    return {
      caseId: row.publicId,
      resolved: row.resolved,
      resolution: row.resolution,
      workUnitRefs: row.workUnitIds.map(opaqueWorkUnitRef).sort(),
      evidenceStatus: !row.resolved && !selectedTargetId ? "unresolved" as const
        : effectiveMatches.length > 0 && effectiveMatches.every((match) => match.modelEligible) &&
          (!selectedTargetId || assembly.targetBlockedReason === null) ? "eligible" as const : "blocked" as const,
      blockReasons: [...new Set([
        ...effectiveMatches.flatMap((match) => match.blockReason ? [match.blockReason] : []),
        ...(selectedTargetId && assembly.targetBlockedReason ? [assembly.targetBlockedReason] : []),
      ])].sort(),
    };
  });
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
    workUnitCoverage: safeWorkUnitCoverage(assembly),
    namedCaseCoverage: safeNamedCaseCoverage(assembly),
    target: assembly.targetDiagnostics ? {
      selectedWorkUnitRef: assembly.targetDiagnostics.selectedWorkUnitId
        ? opaqueWorkUnitRef(assembly.targetDiagnostics.selectedWorkUnitId) : null,
      secondaryWorkUnitRefs: assembly.targetDiagnostics.secondaryWorkUnitIds.map(opaqueWorkUnitRef).sort(),
      requiredThreadCount: assembly.targetDiagnostics.requiredThreadCount,
      scheduledThreadCount: assembly.targetDiagnostics.scheduledThreadCount,
      successfullyLiveRetrievedThreadCount: assembly.targetDiagnostics.successfullyLiveRetrievedThreadCount,
      missingOrFailedThreadCount: assembly.targetDiagnostics.missingOrFailedThreadCount,
      providerFailedThreadCount: assembly.targetDiagnostics.providerFailedThreadCount,
      budgetDeferredThreadCount: assembly.targetDiagnostics.budgetDeferredThreadCount,
      requiredIndexedMessageCount: assembly.targetDiagnostics.requiredIndexedMessageCount,
      successfullyLiveRetrievedMessageCount: assembly.targetDiagnostics.successfullyLiveRetrievedMessageCount,
      includedEvidenceMessageCount: assembly.targetDiagnostics.includedEvidenceMessageCount,
      excludedOrAmbiguousAssociationCount: assembly.targetDiagnostics.excludedOrAmbiguousAssociationCount,
      stoppedAtStage: assembly.targetDiagnostics.stoppedAtStage,
      latestVerifiedSourceAt: assembly.targetDiagnostics.latestVerifiedSourceAt,
      chronologyInvariant: assembly.targetDiagnostics.chronologyInvariant,
      complete: assembly.targetDiagnostics.complete,
    } : null,
    candidateCoverage: assembly.candidateCoverage,
    continuity: assembly.continuity,
    gmail: assembly.gmail ? {
      requiredThreadCount: assembly.gmail.requiredThreadCount,
      scheduledThreadCount: assembly.gmail.scheduledThreadCount,
      requestedThreadCount: assembly.gmail.requestedThreadCount,
      completedThreadCount: assembly.gmail.completedThreadCount,
      failedThreadCount: assembly.gmail.failedThreadCount,
      providerRateLimitedThreadCount: assembly.gmail.providerRateLimitedThreadCount,
      otherProviderErrorThreadCount: assembly.gmail.otherProviderErrorThreadCount,
      missingIndexedThreadCount: assembly.gmail.missingIndexedThreadCount,
      budgetDeferredThreadCount: assembly.gmail.budgetDeferredThreadCount,
      threadFetches: assembly.gmail.threadFetches,
      durationMs: assembly.gmail.durationMs,
      failuresByCode: assembly.gmail.failuresByCode,
    } : null,
    performance: { ...assembly.performance, modelLatencyMs: null, inputBytes: null, outputBytes: null, tokenUsage: null },
    packagePreflight: null,
    validation: null,
    proposal: null,
    acceptance: null,
    safeErrors,
  };
}

function safeSemanticProposal(completion: SterlingTodaySemanticCompletion): SterlingSafeSemanticProposal | null {
  if (!completion.validation?.accepted || !completion.proposal) return null;
  const handles = createSterlingEvidenceHandleMap(completion.assembly.requestWorkingSet).evidenceIdToHandle;
  const citations = (refs: readonly string[]) => refs.flatMap((ref) => {
    const handle = handles.get(ref);
    return handle ? [handle] : [];
  });
  return {
    assessments: completion.proposal.portfolioAssessments.map((assessment) => ({
      workUnitRef: opaqueWorkUnitRef(assessment.workUnitId),
      canonicalLifecycleStage: assessment.currentStage.canonicalLifecycleStage,
      operationalSubstage: assessment.currentStage.operationalSubstage,
      nextStepOwner: assessment.nextStepOwner,
      confidence: assessment.confidence,
      explanation: assessment.explanation,
      citations: citations(assessment.evidenceRefs),
      ambiguities: assessment.ambiguities,
      obligations: assessment.obligations.map((obligation) => ({
        description: obligation.description,
        status: obligation.status,
        responsibleParty: obligation.responsibleParty,
        confidence: obligation.confidence,
        citations: citations(obligation.evidenceRefs),
      })),
    })),
    recommendations: completion.proposal.recommendations.map((recommendation) => ({
      title: recommendation.title,
      summary: recommendation.summary,
      confidence: recommendation.confidence,
      explanation: recommendation.explanation,
      citations: citations(recommendation.evidenceRefs),
      ambiguities: recommendation.ambiguities,
    })),
    portfolioAmbiguities: completion.proposal.portfolioAmbiguities,
    mutationProposalCount: completion.proposal.proposedCanonicalMutations.length,
  };
}

export function safeSemanticResult(completion: SterlingTodaySemanticCompletion): SterlingTodaySafeResult {
  const validation = completion.validation;
  const cases = completion.operationalAcceptance?.cases ?? [];
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
    proposal: safeSemanticProposal(completion),
    acceptance: completion.acceptance && completion.operationalAcceptance ? {
      originalTenPassed: completion.acceptance.passed,
      october21Passed: completion.operationalAcceptance.passed,
      passCount: cases.filter((row) => row.status === "pass").length,
      failCount: cases.filter((row) => row.status === "fail").length,
      unverifiedCount: cases.filter((row) => row.status === "unverified").length,
    } : null,
  };
}

export const STERLING_TODAY_SCOPE_IDENTIFIERS = acceptanceIdentifiers();
