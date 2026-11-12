import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { CONCIERGE_FOREGROUND_MODEL } from "@/lib/continuum/concierge-sol/models";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getContinuumGmailFounderEmail } from "@/lib/continuum/gmail/env";
import { createLiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { isVerifiedContinuumProductionStagingRuntime } from "@/lib/continuum/runtime-env";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { compareOperationalBoard, type ManualObligationAuditRow, type OperationalBoardDisposition,
  type OperationalBoardOwner, type ShadowBoardAuditRow } from "./operational-board-comparison";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";
import { createSterlingRunLease, createSupabaseSterlingRunLeaseStore, STERLING_TODAY_LEASE_KEY } from "./run-lease";
import { getSterlingOperationalShadowExecutionId, isSterlingOperationalShadowEnabled } from "./server-config";
import { assembleSterlingTodayShadow, executeSterlingTodaySemantic } from "./server-runner";

const GMAIL_RETRIEVAL_TIMEOUT_MS = 80_000;
const SCOPE_VERSION = "november-11-operational-v11-23-threads";
const INCOMPATIBLE_WRITE_CONTROLS = [
  "CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED",
  "CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED",
  "CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED",
  "CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED",
  "CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED",
] as const;

function hasIncompatibleWriteControl(): boolean {
  return INCOMPATIBLE_WRITE_CONTROLS.some(
    (name) => process.env[name]?.trim().toLowerCase() === "true",
  );
}

type ReviewSpec = Omit<ManualObligationAuditRow, "workUnitId" | "exactSourceRefs"> & {
  key: string;
  projectId: string | null;
  threadIds: readonly string[];
};

const REVIEW: readonly ReviewSpec[] = [
  { key: "morgan", label: "Morgan Jines", personId: "9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd", projectId: "6c47edeb-33f8-4aa7-bb38-53bbe023fcc3", jobId: null, threadIds: ["1a1c7b0bd23738ca", "1a15fb0c9b520621"], material: true, disposition: "waiting_on_shop", owner: "vendor_shop", lifecycleStage: "cad", jobsExpectedClosed: ["a92280a3-4041-4072-af8e-79e068ca2a0e"] },
  { key: "zane", label: "Zane Kennedy", personId: "0a405703-0f30-4b1e-9a7a-4d0e001fb101", projectId: "12359010-1e95-4296-aa44-a7de7e70aa11", jobId: null, threadIds: ["1a1212396a8ac111", "1a135cb91aa46463", "1a13660ae3fdb7ac", "1a13cc2c1f3d5951", "1a17f4a8f371d911", "1a1847d9ad49e7a4"], material: true, disposition: "founder_action", owner: "founder", lifecycleStage: "quality_control", jobsExpectedClosed: ["e8e8c50e-c010-4c09-b6dc-5926ecc98a8b"] },
  { key: "pennock", label: "J. Pennock", personId: "a3a83570-3d3f-498f-bee4-3000fcde23b9", projectId: "273b9a50-a51a-4379-b656-835b3c96cbeb", jobId: null, threadIds: ["19fd370bc47c5e1f"], material: false, disposition: "resolved", owner: "none", lifecycleStage: "completed", jobsExpectedClosed: [] },
  { key: "natalie", label: "Natalie / Jewelers Mutual", personId: null, projectId: null, jobId: null, threadIds: ["1a1c73a560b06ed3", "1a1a324788df8460"], material: true, disposition: "ambiguous", owner: "unknown", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "sarah", label: "Sarah Leishman", personId: "ec712796-90cf-48ce-bba9-bf943a934109", projectId: "18e9ef2b-5b22-453e-8be8-e54dab0d86b1", jobId: null, threadIds: ["1a0881b53067a9e6", "1a1c7b0f7f034115"], material: true, disposition: "ambiguous", owner: "unknown", lifecycleStage: "cad", jobsExpectedClosed: ["f97d6437-3650-470a-9a3e-7a4f96a90001"] },
  { key: "hyrum", label: "Hyrum Lower", personId: null, projectId: null, jobId: null, threadIds: ["1a1c73c88f29a182"], material: true, disposition: "waiting_on_client", owner: "client", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "jackie", label: "Jackie", personId: null, projectId: null, jobId: null, threadIds: ["1a1474ed83440aa0"], material: false, disposition: "resolved", owner: "none", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "nivoda", label: "Nivoda return", personId: null, projectId: null, jobId: null, threadIds: ["1a14fbe75312902e", "1a1401d44710a95b", "1a1358382fec2179"], material: true, disposition: "ambiguous", owner: "vendor_shop", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "james", label: "James Bowron", personId: "3c845863-81c3-4391-9346-1dd18091c0af", projectId: null, jobId: null, threadIds: ["192ba533c7869445"], material: true, disposition: "ambiguous", owner: "unknown", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "rachel", label: "Rachel", personId: null, projectId: null, jobId: null, threadIds: ["1a1c7447c4492182"], material: true, disposition: "founder_action", owner: "founder", lifecycleStage: null, jobsExpectedClosed: [] },
  { key: "nate", label: "Nate P.", personId: null, projectId: "41281e54-0639-4183-82d5-17028b313681", jobId: null, threadIds: ["1a09120d797337d9", "1a121c53e4587a98", "1a1a6cc69999c55b"], material: true, disposition: "waiting_on_shop", owner: "vendor_shop", lifecycleStage: "production", jobsExpectedClosed: [] },
] as const;

function disposition(owner: string, todayDisposition: string, lifecycle: string | null,
  obligations: readonly { status: string }[]): OperationalBoardDisposition {
  if (todayDisposition === "ambiguous") return "ambiguous";
  const open = obligations.some((row) => row.status === "open" || row.status === "ambiguous");
  if (!open && lifecycle === "completed") return "resolved";
  if (!open && todayDisposition === "suppressed") return "suppressed";
  if (owner === "founder") return "founder_action";
  if (owner === "client") return "waiting_on_client";
  if (owner === "vendor_shop") return "waiting_on_shop";
  return "ambiguous";
}

function owner(value: string): OperationalBoardOwner {
  return value === "founder" || value === "client" || value === "vendor_shop" ? value :
    value === "none" ? "none" : "unknown";
}

export function buildOperationalComparisonInput(
  assembly: Awaited<ReturnType<typeof assembleSterlingTodayShadow>>,
  proposal: NonNullable<Awaited<ReturnType<typeof executeSterlingTodaySemantic>>["proposal"]>,
) {
  const units = assembly.requestWorkingSet.workUnits;
  const expected: ManualObligationAuditRow[] = [];
  const unresolvedExpected: { key: string; reason: string; threadIds: readonly string[] }[] = [];
  for (const spec of REVIEW) {
    const matches = spec.projectId
      ? units.filter((unit) => unit.projectId === spec.projectId)
      : units.filter((unit) => spec.threadIds.some((threadId) => unit.threadIds.includes(threadId)));
    if (matches.length !== 1) {
      unresolvedExpected.push({ key: spec.key, reason: matches.length === 0 ? "no-exact-work-unit" : "multiple-exact-work-units", threadIds: spec.threadIds });
      continue;
    }
    expected.push({ ...spec, workUnitId: matches[0]!.workUnitId,
      exactSourceRefs: spec.threadIds.map((threadId) => `gmail:thread:${threadId}`) });
  }
  const recommendations = new Map(proposal.recommendations.map((row) => [row.workUnitId, row]));
  const actual: ShadowBoardAuditRow[] = proposal.portfolioAssessments.map((assessment) => {
    const unit = units.find((row) => row.workUnitId === assessment.workUnitId)!;
    const project = assembly.requestWorkingSet.projects.find((row) => row.projectId === assessment.projectId);
    const personIds = project?.people.map((row) => row.personId) ?? [];
    const jobIds = assembly.requestWorkingSet.jobs.filter((row) => row.projectId === assessment.projectId && row.state === "open").map((row) => row.jobId);
    return {
      workUnitId: assessment.workUnitId,
      label: unit?.label ?? assessment.workUnitId,
      personId: personIds.length === 1 ? personIds[0]! : recommendations.get(assessment.workUnitId)?.personId ?? null,
      projectId: assessment.projectId,
      jobId: null,
      exactSourceRefs: [...new Set([...(unit?.sourceRefs ?? []), ...(unit?.threadIds ?? []).map((id) => `gmail:thread:${id}`)])],
      disposition: disposition(assessment.nextStepOwner, assessment.todayDisposition,
        assessment.currentStage.canonicalLifecycleStage, assessment.obligations),
      owner: owner(assessment.nextStepOwner),
      lifecycleStage: assessment.currentStage.canonicalLifecycleStage,
      openJobIds: jobIds,
    };
  });
  return { expected, actual, unresolvedExpected, comparison: compareOperationalBoard({ expected, actual }) };
}

export type OperationalShadowResult =
  | { ok: false; verdict: "DISABLED" | "UNAVAILABLE" | "BUSY" | "ALREADY_EXECUTED"; reason: string }
  | { ok: true; verdict: "GENERATED" | "GENERATED_WITH_BLOCKS"; result: Record<string, unknown> };

async function priorLease(client: SupabaseClient, digest: string): Promise<"none" | "running" | "completed" | "failed" | "unavailable"> {
  const { data, error } = await client.from("continuum_sterling_today_run_leases")
    .select("run_digest,run_state,expires_at").eq("lease_key", STERLING_TODAY_LEASE_KEY).maybeSingle();
  if (error) return "unavailable";
  if (!data || data.run_digest !== digest) return "none";
  if (data.run_state === "running" && Date.parse(String(data.expires_at)) <= Date.now()) return "failed";
  return data.run_state === "running" || data.run_state === "completed" || data.run_state === "failed"
    ? data.run_state : "unavailable";
}

export async function runAuthenticatedOperationalShadowReview(): Promise<OperationalShadowResult> {
  if (!isVerifiedContinuumProductionStagingRuntime()) return { ok: false, verdict: "DISABLED", reason: "staging-runtime-not-verified" };
  if (!isSterlingOperationalShadowEnabled()) return { ok: false, verdict: "DISABLED", reason: "operational-shadow-disabled" };
  if (hasIncompatibleWriteControl()) {
    return { ok: false, verdict: "DISABLED", reason: "business-persistence-control-enabled" };
  }
  const executionId = getSterlingOperationalShadowExecutionId();
  if (!executionId) return { ok: false, verdict: "DISABLED", reason: "execution-id-missing-or-invalid" };
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) return { ok: false, verdict: "UNAVAILABLE", reason: "founder-session-unavailable" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, verdict: "UNAVAILABLE", reason: "database-unavailable" };
  const expectedMailboxHash = hashEmail(getContinuumGmailFounderEmail() ?? "");
  const connection = await auth.connections.getFounderConnection().catch(() => null);
  if (!expectedMailboxHash || !connection || connection.status !== "connected" ||
      connection.mailboxEmailHash !== expectedMailboxHash) {
    return { ok: false, verdict: "UNAVAILABLE", reason: "mailbox-identity-not-verified" };
  }
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) return { ok: false, verdict: "UNAVAILABLE", reason: "model-credential-unavailable" };
  const scopeHash = createHash("sha256").update(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.join("\n")).digest("hex");
  const lease = createSterlingRunLease({ mode: "semantic", scopeVersion: `${SCOPE_VERSION}:${scopeHash}:${executionId}` });
  const prior = await priorLease(client, lease.runDigest);
  if (prior === "completed" || prior === "failed") return { ok: false, verdict: "ALREADY_EXECUTED", reason: `execution-${prior}` };
  if (prior === "running") return { ok: false, verdict: "BUSY", reason: "execution-in-progress" };
  if (prior === "unavailable") return { ok: false, verdict: "UNAVAILABLE", reason: "lease-state-unavailable" };
  const leaseStore = createSupabaseSterlingRunLeaseStore(client);
  const claim = await leaseStore.claim(lease);
  if (claim !== "claimed") return { ok: false, verdict: claim === "busy" ? "BUSY" : "UNAVAILABLE", reason: "lease-not-acquired" };
  try {
    const assembly = await assembleSterlingTodayShadow({
      client,
      additionalIndexedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      liveRetrievalThreadAllowlist: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      forcedLiveThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      includeUnindexedLiveMessages: true,
      createGmailBatch: () => createLiveSourceViewerBatch(GMAIL_RETRIEVAL_TIMEOUT_MS),
    });
    const completion = await executeSterlingTodaySemantic({ assembly, apiKey, model: CONCIERGE_FOREGROUND_MODEL });
    if (!completion.proposal) throw new Error("semantic-proposal-unavailable");
    const compared = buildOperationalComparisonInput(assembly, completion.proposal);
    const finished = await leaseStore.finish(lease.runId, "completed", new Date().toISOString());
    if (!finished) return { ok: false, verdict: "UNAVAILABLE", reason: "execution-outcome-unknown" };
    const threadEvidence = NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.map((threadId) => {
      const outcome = assembly.liveThreadOutcomes?.find((row) => row.threadId === threadId);
      return {
        threadId,
        status: outcome?.status ?? "unavailable",
        retrievedAt: outcome?.retrievedAt ?? null,
        indexedMessageCount: outcome?.indexedMessageCount ?? 0,
        observedMessageIds: outcome?.observedMessageIds ?? [],
        unindexedMessageIds: outcome?.unindexedMessageIds ?? [],
        newerUnindexedMessageIds: outcome?.newerUnindexedMessageIds ?? [],
        bodyIncompleteMessageIds: outcome?.bodyIncompleteMessageIds ?? [],
        latestIndexedMessageAt: outcome?.latestIndexedMessageAt ?? null,
        latestLiveMessageAt: outcome?.latestLiveMessageAt ?? null,
        safeErrorCategory: outcome?.safeErrorCategory ?? "missing-outcome",
      };
    });
    const evidenceByThread = new Map<string, typeof threadEvidence[number]>(
      threadEvidence.map((row) => [row.threadId, row]),
    );
    const evidenceLimitations = REVIEW.map((spec) => {
      const rows = spec.threadIds.map((threadId) => evidenceByThread.get(threadId)).filter(Boolean);
      const incompleteThreadIds = rows.filter((row) => row!.status !== "complete_live" || row!.bodyIncompleteMessageIds.length > 0)
        .map((row) => row!.threadId);
      return { key: spec.key, label: spec.label, threadIds: spec.threadIds, incompleteThreadIds,
        bodyIncompletenessPreventsConclusion: incompleteThreadIds.length > 0,
        newerEvidenceIncluded: rows.some((row) => row!.newerUnindexedMessageIds.length > 0),
        freshnessBlocked: rows.length !== spec.threadIds.length || rows.some((row) => row!.status !== "complete_live") };
    });
    return { ok: true, verdict: compared.comparison.passed && completion.verdict === "PASS" ? "GENERATED" : "GENERATED_WITH_BLOCKS", result: {
      contract: "sterling-operational-shadow-v11-sanitized-result-v1",
      runId: lease.runId,
      executionId,
      sourceCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      generatedAt: new Date().toISOString(),
      provider: { name: "OpenAI Responses API", model: CONCIERGE_FOREGROUND_MODEL, store: false },
      scope: { threadCount: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.length, threadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS },
      evidence: threadEvidence,
      evidenceLimitations,
      generatedBoard: compared.actual,
      manualReview: compared.expected,
      unresolvedIdentityMappings: compared.unresolvedExpected,
      comparator: compared.comparison,
      semantic: { verdict: completion.verdict, validationAccepted: completion.validation?.accepted ?? false,
        blockedWorkUnitIds: completion.blockedWorkUnitIds },
      proposedFounderReviewChanges: completion.proposal.proposedCanonicalMutations.map((row) => ({
        proposalKey: row.proposalKey, kind: row.kind, projectId: row.projectId, personId: row.personId,
        jobId: row.jobId, expectedRecordVersion: row.expectedRecordVersion,
        targetLifecycleStage: row.targetLifecycleStage, targetJobState: row.targetJobState,
        targetResponsibleParty: row.targetResponsibleParty,
        newJob: row.newJob ? { kind: row.newJob.kind, responsibleParty: row.newJob.responsibleParty,
          dueAt: row.newJob.dueAt, detailPresent: Boolean(row.newJob.detail) } : null,
        evidenceRefs: row.evidenceRefs,
        requiresFounderApproval: true,
      })),
      relationshipProposals: completion.proposal.relationshipProposals.map((row) => ({
        proposalKey: row.proposalKey, kind: row.kind, workUnitId: row.workUnitId,
        personId: row.personId, projectId: row.projectId, threadIds: row.threadIds,
        basis: row.basis, confidence: row.confidence, evidenceRefs: row.evidenceRefs,
        requiresFounderApproval: true,
      })),
      persistence: { businessWrites: false, gmailIndexWrites: false, checkpointWrites: false,
        tokenRefreshWrites: false, leaseMetadataWrite: true, browserSessionCache: true },
    } };
  } catch {
    await leaseStore.finish(lease.runId, "failed", new Date().toISOString()).catch(() => false);
    return { ok: false, verdict: "UNAVAILABLE", reason: "operational-shadow-execution-failed" };
  }
}
