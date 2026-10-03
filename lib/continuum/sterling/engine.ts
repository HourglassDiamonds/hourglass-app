import { createHash, randomUUID } from "node:crypto";
import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate, OpenJobPayload } from "@/lib/continuum/candidates/types";
import type { OpenJobActor, ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { fingerprintCanonicalState } from "./fingerprint";
import { parseConditionalHold } from "./holds/parser";
import { decisionContextForProposal, deriveLedgerPreferenceSignals } from "./ledger/preferences";
import type { SterlingProposalRecord } from "./ledger/types";
import { sterlingModelRoute } from "./model";
import {
  STERLING_CONTRACT_VERSION,
  STERLING_PROMPT_VERSION,
  type SterlingFinding,
  type SterlingOwner,
  type SterlingPreferenceSignal,
  type SterlingPriority,
  type SterlingProposal,
  type SterlingProposedAction,
  type SterlingResponse,
  type SterlingTruth,
} from "./types";

export type SterlingIntent =
  | "next-three"
  | "missing"
  | "waiting-founder"
  | "waiting-client"
  | "waiting-shop"
  | "captures"
  | "changed"
  | "conditional-hold";

export function parseSterlingIntent(query: string): SterlingIntent | null {
  const text = query.toLowerCase().replace(/[’']/g, "'");
  if (/\b(?:hold(?: off)?|pause|snooze|wait (?:until|for)|leave .* alone|don'?t (?:show|surface|bug)|resume .* (?:when|after|once))\b/i.test(text)) return "conditional-hold";
  if (/next\s+(?:three|3)\s+best|what should i do next|top\s+(?:three|3)/i.test(text)) return "next-three";
  if (/what am i missing|what should i clean up|missing\?/i.test(text)) return "missing";
  if (/review (?:my )?recent captures|quick capture|speak capture/i.test(text)) return "captures";
  if (/what changed since yesterday/i.test(text)) return "changed";
  if (/waiting on (?:me|founder)|my (?:move|turn)/i.test(text)) return "waiting-founder";
  if (/waiting on (?:clients?|customers?)/i.test(text)) return "waiting-client";
  if (/waiting on (?:the )?(?:shop|vendors?)/i.test(text)) return "waiting-shop";
  return null;
}

export function runSterling(input: {
  truth: SterlingTruth;
  intent: SterlingIntent;
  modelOverride?: string | null;
  now?: Date;
  runId?: string;
  proposalHistory?: readonly SterlingProposalRecord[];
  query?: string;
}): SterlingResponse {
  const started = Date.now();
  const now = input.now ?? new Date(input.truth.generatedAt);
  const route = sterlingModelRoute(input.modelOverride);
  const runId = input.runId ?? randomUUID();
  const ledgerPreferences = deriveLedgerPreferenceSignals(input.proposalHistory ?? []);
  const holdResult = input.intent === "conditional-hold"
    ? parseConditionalHold(input.query ?? "", input.truth, now)
    : null;
  const allFindings = input.intent === "conditional-hold"
    ? holdFindings(holdResult)
    : applyDecisionContext(detectFindings(input.truth, now), ledgerPreferences);
  const priorities = input.intent === "next-three" ? nextThree(input.truth, now) : [];
  const findings = input.intent === "conditional-hold" ? allFindings : findingsForIntent(allFindings, input.truth, input.intent);
  const proposals = findings.flatMap((row) => (row.proposal ? [row.proposal] : []));
  const uncertainty = uncertaintyFor(input.truth, input.intent);
  return {
    kind: responseKind(input.intent),
    headline: headlineFor(input.intent),
    summary: summaryFor(input.intent, priorities.length, findings.length, uncertainty),
    priorities,
    findings,
    proposals,
    preferences: [...ledgerPreferences, ...inferPreferences(input.truth.candidates)],
    uncertainty,
    telemetry: {
      contractVersion: STERLING_CONTRACT_VERSION,
      model: route.model,
      modelConfiguration: route.configuration,
      promptVersion: STERLING_PROMPT_VERSION,
      latencyMs: Math.max(0, Date.now() - started),
      promptTokens: null,
      completionTokens: null,
      estimatedCostUsd: null,
      toolsInvoked: toolsFor(input.intent),
      proposalCount: proposals.length,
      failures: input.truth.sourceStatus === "disconnected" ? ["current-truth-disconnected"] : [],
      fallback: "deterministic",
      runId,
      provider: route.provider,
    },
    ledgerStatus: "not-applicable",
  };
}

function holdFindings(result: ReturnType<typeof parseConditionalHold> | null): SterlingFinding[] {
  if (!result) return [];
  if (result.kind === "clarification") return [{ id: "conditional-hold:clarification", kind: "uncertainty", title: "I need one detail before proposing a hold", whyItMatters: result.message, evidence: [], sourceRefs: [], proposedFix: result.message, proposal: null }];
  const job = result.job;
  return [{
    id: `conditional-hold:${job.jobId}`, kind: "gap", title: `Hold ${job.subject}`,
    whyItMatters: "This removes the job from active Today while preserving the canonical job and its history.",
    evidence: job.sourceRef ? [job.sourceRef] : [], sourceRefs: job.sourceRef ? [job.sourceRef] : [],
    proposedFix: result.proposedState,
    proposal: proposal({
      kind: "conditional_hold", entityKind: "job", entityId: job.jobId,
      currentState: job.state, proposedState: result.proposedState, reason: result.reason,
      evidence: job.sourceRef ? [job.sourceRef] : [], downstream: "Suppress this job from active Today. Meeting the condition creates a resume-ready state; it does not silently reactivate the job.",
      canApply: true, currentStateSnapshot: job,
      proposedAction: { kind: "activate_hold", holdId: deterministicUuid(`hold|${job.jobId}|${result.proposedState}|${job.updatedAt}`), projectId: job.projectId, jobId: job.jobId, expectedUpdatedAt: job.updatedAt, reason: result.reason, condition: result.condition, sourceRefs: job.sourceRef ? [job.sourceRef] : [] },
    }),
  }];
}

function applyDecisionContext(
  findings: SterlingFinding[],
  signals: readonly SterlingPreferenceSignal[],
): SterlingFinding[] {
  return findings.map((finding) => {
    if (!finding.proposal) return finding;
    const context = decisionContextForProposal(finding.proposal.kind, signals);
    return context ? { ...finding, whyItMatters: `${finding.whyItMatters} ${context}` } : finding;
  });
}

export function nextThree(truth: SterlingTruth, now: Date): SterlingPriority[] {
  if (truth.sourceStatus === "disconnected") return [];
  const meaningful = truth.today.filter((item) => item.owner === "founder" && item.authoritative);
  return [...meaningful]
    .sort((a, b) => comparePriority(a, b, now))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      whyNow: whyNow(item, now),
      evidenceSummary: item.why,
      urgencyReason: urgencyReason(item, now),
      owner: item.owner,
      state: item.state,
      proposedNextAction: item.proposedNextAction || item.title,
      confidence: item.sourceRefs.length > 0 ? "high" : "medium",
      sourceRefs: [...item.sourceRefs],
      canonicalIds: [item.id, item.projectId].filter((value): value is string => Boolean(value)),
    }));
}

function comparePriority(
  a: SterlingTruth["today"][number],
  b: SterlingTruth["today"][number],
  now: Date,
): number {
  const tuple = (item: SterlingTruth["today"][number]) => [
    dueRank(item.dueAt, now),
    item.clientFacing ? 0 : 1,
    item.productionBlocker ? 0 : 1,
    item.projectId ? 0 : 1,
  ];
  const left = tuple(a);
  const right = tuple(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return a.id.localeCompare(b.id);
}

function dueRank(dueAt: string | null, now: Date): number {
  if (!dueAt) return 4;
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return 4;
  const days = Math.ceil((due - now.getTime()) / 86_400_000);
  if (days < 0) return 0;
  if (days <= 1) return 1;
  if (days <= 3) return 2;
  return 3;
}

function whyNow(item: SterlingTruth["today"][number], now: Date): string {
  const urgency = urgencyReason(item, now);
  return urgency === "No explicit deadline is recorded." ? item.why : `${urgency} ${item.why}`;
}

function urgencyReason(item: SterlingTruth["today"][number], now: Date): string {
  if (item.dueAt) {
    const due = Date.parse(item.dueAt);
    if (Number.isFinite(due)) {
      const days = Math.ceil((due - now.getTime()) / 86_400_000);
      if (days < 0) return "The recorded deadline is overdue.";
      if (days === 0) return "The recorded deadline is today.";
      if (days === 1) return "The recorded deadline is tomorrow.";
      return `A recorded deadline is ${days} days away.`;
    }
  }
  if (item.productionBlocker) return "This blocks production or a downstream handoff.";
  if (item.clientFacing) return "This is active client-facing work.";
  return "No explicit deadline is recorded.";
}

export function detectFindings(truth: SterlingTruth, now: Date): SterlingFinding[] {
  return uniqueFindings([
    ...anomalyFindings(truth),
    ...jobTruthConflicts(truth),
    ...duplicateJobs(truth.openJobs),
    ...captureFindings(truth.candidates, truth.openJobs),
    ...staleWaiting(truth.openJobs, now),
  ]);
}

function anomalyFindings(truth: SterlingTruth): SterlingFinding[] {
  return truth.anomalies.map((row) => {
    const job = row.jobId ? truth.openJobs.find((item) => item.jobId === row.jobId) ?? null : null;
    return ({
    id: `anomaly:${row.id}`,
    kind: row.kind === "contradicts-completion" ? "conflict" : "gap",
    title: row.headline,
    whyItMatters: row.detail,
    evidence: [row.detail],
    sourceRefs: row.sourceRefs,
    proposedFix: row.jobId
      ? "Review the canonical Job against the newer source evidence."
      : "Review and map this evidence to canonical work.",
    proposal: row.jobId
      ? proposal({
          kind: "stale_resolution",
          entityKind: "job",
          entityId: row.jobId,
          currentState: "Unresolved canonical Job",
          proposedState: "Founder-reviewed resolution or corrected state",
          reason: row.detail,
          evidence: row.sourceRefs,
          downstream: "Today will be recomputed only after founder approval through the canonical Job writer.",
          canApply: true,
          currentStateSnapshot: job ?? { jobId: row.jobId, anomalyId: row.id },
          proposedAction: { kind: "unsupported", reason: "The intended correction requires founder selection." },
        })
      : null,
    });
  });
}

function jobTruthConflicts(truth: SterlingTruth): SterlingFinding[] {
  const current = new Map(
    truth.today.filter((item) => item.projectId).map((item) => [item.projectId!, item]),
  );
  return truth.openJobs.flatMap((job) => {
    if (job.state !== "open" || !job.projectId) return [];
    const item = current.get(job.projectId);
    if (!item) return [];
    const jobOwner = ownerOf(job.waitingOnActor);
    if (item.owner === "unknown" || jobOwner === item.owner) return [];
    const proposedActor = actorOf(item.owner);
    return [
      {
        id: `conflict:${job.jobId}`,
        kind: "conflict" as const,
        title: `${job.subject} conflicts with newer current truth`,
        whyItMatters: `The Job says ${jobOwner} owns the next step, while current Today evidence says ${item.owner}.`,
        evidence: [job.sourceRef, ...item.sourceRefs].filter((value): value is string => Boolean(value)),
        sourceRefs: item.sourceRefs,
        proposedFix: `Propose changing the Job waiting state to ${proposedActor}; do not change it automatically.`,
        proposal: proposal({
          kind: "waiting_state",
          entityKind: "job",
          entityId: job.jobId,
          currentState: job.waitingOnActor,
          proposedState: proposedActor,
          reason: `Current evidence assigns the next step to ${item.owner}.`,
          evidence: item.sourceRefs,
          downstream: "Approval updates the canonical Job through mutateJob and then refreshes Today.",
          canApply: true,
          currentStateSnapshot: job,
          proposedAction: {
            kind: "update_job",
            projectId: job.projectId,
            jobId: job.jobId,
            expectedUpdatedAt: job.updatedAt,
            waitingOnActor: proposedActor,
          },
        }),
      },
    ];
  });
}

function duplicateJobs(jobs: readonly ProjectJob[]): SterlingFinding[] {
  const unresolved = jobs.filter((job) => job.state === "open" || job.state === "snoozed");
  const groups = new Map<string, ProjectJob[]>();
  for (const job of unresolved) {
    const key = `${job.projectId ?? "projectless"}:${normalize(job.subject)}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => ({
      id: `duplicate:${rows.map((row) => row.jobId).sort().join(":")}`,
      kind: "duplicate" as const,
      title: `Possible duplicate: ${rows[0]!.subject}`,
      whyItMatters: `${rows.length} unresolved canonical Jobs have the same normalized action identity.`,
      evidence: rows.map((row) => `${row.jobId} · ${row.sourceSystem} · ${row.createdAt}`),
      sourceRefs: rows.flatMap((row) => (row.sourceRef ? [row.sourceRef] : [])),
      proposedFix: "Choose the surviving Job and explicitly resolve or cancel the duplicate after review.",
      proposal: proposal({
        kind: "duplicate_merge",
        entityKind: "job",
        entityId: rows[0]!.jobId,
        currentState: rows.map((row) => row.jobId).join(", "),
        proposedState: "One surviving canonical Job; duplicate resolved or cancelled",
        reason: "The unresolved Jobs share the same project and normalized subject.",
        evidence: rows.flatMap((row) => (row.sourceRef ? [row.sourceRef] : [])),
        downstream: "Founder approval must choose the survivor; Sterling does not merge or delete records.",
        canApply: false,
        currentStateSnapshot: rows[0],
        proposedAction: { kind: "unsupported", reason: "Duplicate resolution requires choosing a survivor." },
      }),
    }));
}

function captureFindings(
  candidates: readonly ContinuumCandidate[],
  jobs: readonly ProjectJob[],
): SterlingFinding[] {
  const open = jobs.filter((job) => job.state === "open" || job.state === "snoozed");
  return candidates.flatMap<SterlingFinding>((candidate): SterlingFinding[] => {
    const effectivePayload = effectiveCandidatePayload(candidate);
    const effectiveTarget = effectiveCandidateTarget(candidate);
    if (candidate.reviewStatus !== "pending" || effectivePayload.kind !== "open_job") return [];
    const payload = effectivePayload as OpenJobPayload;
    const targetProjectId =
      effectiveTarget.kind === "open_job" ? effectiveTarget.projectId : null;
    const duplicate = open.find(
      (job) =>
        job.projectId === targetProjectId && normalize(job.subject) === normalize(payload.subject),
    );
    if (duplicate) {
      return [
        {
          id: `capture-duplicate:${candidate.candidateId}`,
          kind: "duplicate" as const,
          title: `Recent capture matches ${duplicate.subject}`,
          whyItMatters: "Approving the capture as a new Job would duplicate existing canonical work.",
          evidence: [candidate.sourceRef, duplicate.sourceRef].filter(
            (value): value is string => Boolean(value),
          ),
          sourceRefs: [candidate.sourceRef],
          proposedFix:
            "Review the capture as supporting evidence for the existing Job instead of creating another Job.",
          proposal: proposal({
            kind: "duplicate_merge",
            entityKind: "candidate",
            entityId: candidate.candidateId,
            currentState: "Pending capture proposal",
            proposedState: `Associate with existing Job ${duplicate.jobId}`,
            reason: "The normalized action and project already exist as unresolved canonical work.",
            evidence: [candidate.sourceRef, duplicate.sourceRef].filter(
              (value): value is string => Boolean(value),
            ),
            downstream: "The existing Candidate review UI remains the approval boundary.",
            canApply: false,
            currentStateSnapshot: candidate,
            proposedAction: { kind: "unsupported", reason: "Candidate association is not a canonical Job mutation." },
          }),
        },
      ];
    }
    if (targetProjectId == null) {
      return [
        {
          id: `capture-orphan:${candidate.candidateId}`,
          kind: "orphan" as const,
          title: payload.subject,
          whyItMatters: "This actionable capture has no supported Project mapping.",
          evidence: [candidate.sourceRef],
          sourceRefs: [candidate.sourceRef],
          proposedFix:
            "Confirm whether this is legitimately projectless or edit the proposal to a known Project before approval.",
          proposal: proposal({
            kind: "new_projectless_job",
            entityKind: "candidate",
            entityId: candidate.candidateId,
            currentState: "Pending capture with no Project",
            proposedState: "Founder-confirmed projectless Job or mapped Project Job",
            reason: "Continuum has no supported Project association for this capture.",
            evidence: [candidate.sourceRef],
            downstream: "Approval uses the existing Candidate review and canonical Job writer.",
            canApply: true,
            currentStateSnapshot: candidate,
            proposedAction: {
              kind: "create_projectless_job",
              candidateId: candidate.candidateId,
              jobKind: payload.jobKind,
              subject: payload.subject,
              detail: payload.detail,
              waitingOnActor: payload.waitingOnActor,
              dueAt: payload.dueAt,
              sourceRef: candidate.sourceRef,
            },
          }),
        },
      ];
    }
    return [];
  });
}

function staleWaiting(jobs: readonly ProjectJob[], now: Date): SterlingFinding[] {
  return jobs.flatMap((job) => {
    if (
      job.state !== "open" ||
      (job.waitingOnActor !== "client" && job.waitingOnActor !== "vendor")
    ) {
      return [];
    }
    const age = Math.floor(
      (now.getTime() - Date.parse(job.updatedAt || job.createdAt)) / 86_400_000,
    );
    if (!Number.isFinite(age) || age < 14) return [];
    return [
      {
        id: `stale:${job.jobId}`,
        kind: "stale" as const,
        title: `${job.subject} has waited ${age} days`,
        whyItMatters:
          "The waiting state is old enough to require evidence review, but age alone does not prove completion.",
        evidence: [job.sourceRef || `job:${job.jobId}`, `last updated ${job.updatedAt}`],
        sourceRefs: job.sourceRef ? [job.sourceRef] : [],
        proposedFix: "Check recent source evidence and then explicitly follow up, defer, or resolve.",
        proposal: proposal({
          kind: "follow_up",
          entityKind: "job",
          entityId: job.jobId,
          currentState: `Waiting on ${job.waitingOnActor} since ${job.updatedAt}`,
          proposedState: "Founder-reviewed follow-up or confirmed continued wait",
          reason: `No canonical update has been recorded for ${age} days.`,
          evidence: job.sourceRef ? [job.sourceRef] : [],
          downstream: "No action occurs until the founder chooses a canonical Job mutation.",
          canApply: false,
          currentStateSnapshot: job,
          proposedAction: { kind: "unsupported", reason: "Follow-up execution is not supported in V1." },
        }),
      },
    ];
  });
}

function findingsForIntent(
  all: SterlingFinding[],
  truth: SterlingTruth,
  intent: SterlingIntent,
): SterlingFinding[] {
  if (intent === "missing") return all.slice(0, 8);
  if (intent === "captures") return all.filter((row) => row.id.startsWith("capture-")).slice(0, 8);
  if (intent === "changed") return [];
  const owner =
    intent === "waiting-founder"
      ? "founder"
      : intent === "waiting-client"
        ? "client"
        : intent === "waiting-shop"
          ? "shop"
          : null;
  if (!owner) return [];
  return truth.today
    .filter((item) => item.owner === owner)
    .slice(0, 8)
    .map((item) => ({
      id: `waiting:${item.id}`,
      kind: "gap",
      title: item.title,
      whyItMatters: item.why,
      evidence: item.sourceRefs,
      sourceRefs: item.sourceRefs,
      proposedFix:
        item.proposedNextAction ||
        (owner === "founder"
          ? "Take the recorded next action."
          : "Keep this in the waiting lane until newer evidence arrives."),
      proposal: null,
    }));
}

function uncertaintyFor(truth: SterlingTruth, intent: SterlingIntent): string[] {
  const rows: string[] = [];
  if (truth.sourceStatus === "disconnected") {
    rows.push("Current Continuum truth is disconnected; Sterling will not invent priorities.");
  }
  if (truth.sourceStatus === "refreshing") {
    rows.push("Today is refreshing; these results use the last published canonical snapshot.");
  }
  if (intent === "changed") {
    rows.push(
      "A comparable yesterday snapshot is not exposed by the current read contract, so no change claims were made.",
    );
  }
  if (truth.today.length === 0 && truth.sourceStatus !== "disconnected") {
    rows.push("No authoritative Today items currently require founder action.");
  }
  return rows;
}

function inferPreferences(candidates: readonly ContinuumCandidate[]) {
  const reviewed = candidates.filter((row) => row.lastReviewAction != null);
  const approvals = reviewed.filter((row) => row.reviewStatus === "approved").length;
  const rejections = reviewed.filter((row) => row.reviewStatus === "discarded").length;
  if (approvals + rejections < 3) return [];
  return [
    {
      key: "proposal-acceptance",
      description:
        approvals >= rejections
          ? "Recent reviewed proposals are more often approved than discarded."
          : "Recent reviewed proposals are more often discarded than approved.",
      supportingDecisionCount: approvals + rejections,
      confidence: approvals + rejections >= 8 ? ("high" as const) : ("medium" as const),
      reviewable: true as const,
    },
  ];
}

function proposal(input: {
  kind: SterlingProposal["kind"];
  entityKind: SterlingProposal["affectedEntity"]["kind"];
  entityId: string;
  currentState: string;
  proposedState: string;
  reason: string;
  evidence: readonly string[];
  downstream: string;
  canApply: boolean;
  currentStateSnapshot: unknown;
  proposedAction: SterlingProposedAction;
  confidence?: SterlingProposal["confidence"];
}): SterlingProposal {
  const currentStateFingerprint = fingerprintCanonicalState(input.currentStateSnapshot);
  return {
    proposalId: deterministicUuid(
      `${input.kind}|${input.entityKind}|${input.entityId}|${input.proposedState}|${currentStateFingerprint}`,
    ),
    kind: input.kind,
    affectedEntity: { kind: input.entityKind, id: input.entityId },
    currentState: input.currentState,
    proposedState: input.proposedState,
    reason: input.reason,
    evidence: [...input.evidence],
    expectedDownstreamEffect: input.downstream,
    status: "review-required",
    canApplyWithExistingWriter: input.canApply,
    confidence: input.confidence ?? (input.evidence.length > 0 ? "high" : "medium"),
    currentStateFingerprint,
    currentStateSnapshot: input.currentStateSnapshot,
    proposedAction: input.proposedAction,
    persistence: "pending",
  };
}

function deterministicUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function ownerOf(actor: OpenJobActor): SterlingOwner {
  if (actor === "founder" || actor === "hourglass") return "founder";
  if (actor === "client") return "client";
  if (actor === "vendor") return "shop";
  return "unknown";
}

function actorOf(owner: SterlingOwner): OpenJobActor {
  if (owner === "founder") return "founder";
  if (owner === "client") return "client";
  if (owner === "shop") return "vendor";
  return "unknown";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueFindings(rows: SterlingFinding[]): SterlingFinding[] {
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id)));
}

function responseKind(intent: SterlingIntent): SterlingResponse["kind"] {
  if (intent === "conditional-hold") return "conditional-hold";
  if (intent === "next-three") return "next-three";
  if (intent === "missing") return "missing";
  if (intent === "captures") return "captures";
  if (intent === "changed") return "changed";
  return "waiting";
}

function headlineFor(intent: SterlingIntent): string {
  if (intent === "conditional-hold") return "Conditional hold review";
  if (intent === "next-three") return "Next best work";
  if (intent === "missing") return "What may be missing";
  if (intent === "captures") return "Recent captures in context";
  if (intent === "changed") return "Changes since yesterday";
  if (intent === "waiting-founder") return "Waiting on you";
  if (intent === "waiting-client") return "Waiting on clients";
  return "Waiting on the shop";
}

function summaryFor(
  intent: SterlingIntent,
  priorities: number,
  findings: number,
  uncertainty: readonly string[],
): string {
  if (uncertainty.some((row) => /disconnected/i.test(row))) {
    return "Continuum truth is unavailable, so Sterling did not rank or propose work.";
  }
  if (intent === "next-three") {
    return priorities === 0
      ? "Nothing authoritative needs your action right now."
      : `${priorities} grounded ${priorities === 1 ? "priority" : "priorities"}; no padding.`;
  }
  if (intent === "changed") return "No comparison was produced without a canonical prior snapshot.";
  if (intent === "conditional-hold") return findings === 0 ? "I need more detail before proposing a hold." : "Review the scoped hold below. Nothing changes until you approve it.";
  return findings === 0
    ? "No grounded findings in the current bounded scan."
    : `${findings} grounded ${findings === 1 ? "finding" : "findings"}.`;
}

function toolsFor(intent: SterlingIntent): string[] {
  if (intent === "conditional-hold") return ["get_current_today", "get_open_jobs", "propose_conditional_hold"];
  if (intent === "next-three") {
    return ["get_current_today", "get_open_jobs", "get_recent_founder_decisions"];
  }
  if (intent === "captures") {
    return ["get_quick_capture_proposals", "get_open_jobs", "get_project_context"];
  }
  if (intent === "missing") {
    return [
      "get_current_today",
      "get_open_jobs",
      "get_waiting_work",
      "get_recent_source_evidence",
      "get_quick_capture_proposals",
    ];
  }
  if (intent === "changed") return ["get_current_today"];
  return ["get_waiting_work", "get_open_jobs"];
}
