import {
  CANDIDATE_SOURCE_REF_MAX,
  CANDIDATE_SOURCE_SYSTEMS,
} from "@/lib/continuum/candidates/types";
import {
  isOpenJobActor,
  isOpenJobKind,
  parseOpenJobDetail,
  parseOpenJobSubject,
  parseOptionalDue,
  parseOptionalIso,
} from "@/lib/continuum/client-memory/project-jobs/validate";
import {
  deskJobsFromCanonical,
  sortProjectJobs,
} from "@/lib/continuum/client-memory/project-jobs/read";
import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import { MANUAL_NOTE_MAX_LENGTH } from "@/lib/continuum/client-memory/write/types";
import type { ConciergePersonProfileResult } from "@/lib/continuum/client-memory/read/types";
import type { ContinuumJsonValue } from "@/lib/continuum/contracts/types";
import {
  CONTINUUM_AGENT_CONTRACT_VERSION,
  CONTINUUM_AGENT_READ_OPERATIONS,
  type AgentClientContext,
  type AgentCommitments,
  type AgentContractFailure,
  type AgentContractMetadata,
  type AgentContractProvenance,
  type AgentContractRequest,
  type AgentContractResult,
  type AgentContractReview,
  type AgentCurrentTruth,
  type AgentOpenJob,
  type AgentProposalReceipt,
  type AgentProposalRequest,
  type AgentStateChangeProposal,
  type AgentToday,
  type AgentWaitingOn,
  type ContinuumAgentReadOperation,
} from "./types";
import type { ContinuumAgentWorld } from "./world";

const MAX_REQUEST_ID = 128;
const MAX_PROJECTS = 24;
const MAX_OPEN_JOBS = 20;
const MAX_PROVENANCE = 32;
const MAX_REVIEW_REASONS = 8;
const MAX_FACT_STRING = 500;
const MAX_FACT_ARRAY = 10;
const MAX_FACT_KEYS = 12;
const MAX_FACT_DEPTH = 3;
const MAX_AGENT_NOTE = Math.min(MANUAL_NOTE_MAX_LENGTH, 2_000);

export type AgentContractData =
  | AgentCurrentTruth
  | AgentClientContext
  | { jobs: AgentOpenJob[] }
  | AgentWaitingOn
  | AgentCommitments
  | AgentToday
  | AgentProposalReceipt;

type ContractOperation = AgentContractMetadata["operation"];
type UnknownRequest = { requestId?: unknown; operation?: unknown } & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function operationOf(value: unknown): ContractOperation {
  if (value === "propose_state_change") return value;
  if (
    typeof value === "string" &&
    (CONTINUUM_AGENT_READ_OPERATIONS as readonly string[]).includes(value)
  ) {
    return value as ContinuumAgentReadOperation;
  }
  return "unsupported";
}

function review(reasons: readonly string[] = []): AgentContractReview {
  const unique = [...new Set(reasons.filter(Boolean))].slice(0, MAX_REVIEW_REASONS);
  return {
    status: unique.length > 0 ? "needs_review" : "clear",
    reasons: unique,
  };
}

function metadata(input: {
  requestId: string;
  operation: ContractOperation;
  now: Date;
  truncated?: boolean;
  reasons?: readonly string[];
  provenance?: readonly AgentContractProvenance[];
}): AgentContractMetadata {
  return {
    contractVersion: CONTINUUM_AGENT_CONTRACT_VERSION,
    requestId: input.requestId,
    operation: input.operation,
    capability: input.operation === "propose_state_change" ? "proposal" : "read",
    asOf: input.now.toISOString(),
    truncated: input.truncated ?? false,
    review: review(input.reasons),
    provenance: [...(input.provenance ?? [])].slice(0, MAX_PROVENANCE),
  };
}

function failed(
  meta: AgentContractMetadata,
  code: AgentContractFailure["error"]["code"],
  message: string,
): AgentContractFailure {
  return { ...meta, ok: false, error: { code, message } };
}

function succeeded<T>(meta: AgentContractMetadata, data: T): AgentContractResult<T> {
  return { ...meta, ok: true, data };
}

function boundedLimit(value: unknown, fallback: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.max(1, Math.min(value, maximum));
}

function boundedJson(
  value: ContinuumJsonValue,
  depth = 0,
): { value: ContinuumJsonValue; truncated: boolean } {
  if (typeof value === "string") {
    return value.length > MAX_FACT_STRING
      ? { value: value.slice(0, MAX_FACT_STRING), truncated: true }
      : { value, truncated: false };
  }
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return { value, truncated: false };
  }
  if (depth >= MAX_FACT_DEPTH) return { value: "[bounded]", truncated: true };
  if (Array.isArray(value)) {
    let truncated = value.length > MAX_FACT_ARRAY;
    const items = value.slice(0, MAX_FACT_ARRAY).map((item) => {
      const bounded = boundedJson(item, depth + 1);
      truncated ||= bounded.truncated;
      return bounded.value;
    });
    return { value: items, truncated };
  }
  let truncated = Object.keys(value).length > MAX_FACT_KEYS;
  const entries = Object.entries(value).slice(0, MAX_FACT_KEYS).map(([key, item]) => {
    const bounded = boundedJson(item, depth + 1);
    truncated ||= bounded.truncated;
    return [key, bounded.value] as const;
  });
  return { value: Object.fromEntries(entries), truncated };
}

function personReviewReasons(result: ConciergePersonProfileResult): string[] {
  if (!result.ok) return [];
  const reasons: string[] = [];
  if (result.profile.reviews.openCount > 0) reasons.push("identity_review_open");
  if (result.profile.facts.conflictingCount > 0) reasons.push("conflicting_facts");
  if (result.profile.facts.candidateCount > 0) reasons.push("candidate_facts_present");
  return reasons;
}

async function currentTruth(
  world: ContinuumAgentWorld,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<AgentCurrentTruth>> {
  const source = await world.groupCurrentProjects(now.toISOString());
  let remaining = MAX_PROJECTS;
  let total = 0;
  const reasons: string[] = [];
  const provenance: AgentContractProvenance[] = [];
  const groups = source.map((group) => {
    total += group.projects.length;
    const selected = group.projects.slice(0, remaining);
    remaining -= selected.length;
    for (const row of selected) {
      provenance.push({ kind: "project", id: row.projectId });
      if (row.currentAction.source === "unrecorded") {
        reasons.push("current_action_unrecorded");
      }
    }
    return {
      id: group.id,
      label: group.label,
      projects: selected.map((row) => ({
        projectId: row.projectId,
        title: row.title,
        state: group.id,
        currentAction: row.currentAction.detail ?? row.currentAction.label ?? null,
        lifecycleStage: row.lifecycleStage,
        dueAt: row.actionDueAt,
      })),
    };
  }).filter((group) => group.projects.length > 0);
  return succeeded(
    metadata({
      requestId,
      operation: "get_current_truth",
      now,
      truncated: total > MAX_PROJECTS,
      reasons,
      provenance,
    }),
    { groups },
  );
}

async function resolvePerson(
  world: ContinuumAgentWorld,
  raw: UnknownRequest,
): Promise<
  | { ok: true; result: Extract<ConciergePersonProfileResult, { ok: true }> }
  | { ok: false; code: "ambiguous_identity" | "not_found" | "invalid_request"; message: string }
> {
  const personId = cleanText(raw.personId);
  if (personId) {
    const result = await world.getPersonProfile(personId);
    return result.ok
      ? { ok: true, result }
      : { ok: false, code: "not_found", message: "Person was not found." };
  }
  const query = cleanText(raw.query);
  if (!query) {
    return {
      ok: false,
      code: "invalid_request",
      message: "A personId or identity query is required.",
    };
  }
  const byId = new Map((await world.searchPeople(query)).map((row) => [row.personId, row]));
  if (byId.size === 0) {
    return { ok: false, code: "not_found", message: "No matching Person was found." };
  }
  if (byId.size !== 1) {
    return {
      ok: false,
      code: "ambiguous_identity",
      message: "Identity matched more than one Person; provide an explicit personId.",
    };
  }
  const personIdMatch = [...byId.keys()][0];
  if (!personIdMatch) {
    return { ok: false, code: "not_found", message: "No matching Person was found." };
  }
  const result = await world.getPersonProfile(personIdMatch);
  return result.ok
    ? { ok: true, result }
    : { ok: false, code: "not_found", message: "Person was not found." };
}

async function clientContext(
  world: ContinuumAgentWorld,
  raw: UnknownRequest,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<AgentClientContext>> {
  const resolved = await resolvePerson(world, raw);
  const base = metadata({ requestId, operation: "get_client_context", now });
  if (!resolved.ok) return failed(base, resolved.code, resolved.message);
  const profile = resolved.result.profile;
  const projects = profile.projects.slice(0, 8);
  const facts = profile.facts.current.slice(0, 12);
  const boundedFacts = facts.map((row) => ({ row, bounded: boundedJson(row.value) }));
  const reasons = personReviewReasons(resolved.result);
  return succeeded(
    metadata({
      requestId,
      operation: "get_client_context",
      now,
      truncated:
        profile.projects.length > projects.length ||
        profile.facts.current.length > facts.length ||
        boundedFacts.some((row) => row.bounded.truncated),
      reasons,
      provenance: [
        { kind: "person", id: profile.person.id },
        ...projects.map((row) => ({ kind: "project" as const, id: row.profile.projectId })),
      ],
    }),
    {
      person: {
        personId: profile.person.id,
        displayName: profile.person.displayName,
        organizationName: profile.person.organizationName,
        roles: [...profile.person.roles],
      },
      projects: projects.map((row) => ({
        projectId: row.profile.projectId,
        title: row.profile.displayTitle,
        projectKind: row.profile.projectKind ?? null,
        cadJobNumber: row.internalHistory?.cadJobNumber ?? null,
        orderNumber: row.internalHistory?.orderNumber ?? null,
      })),
      facts: boundedFacts.map(({ row, bounded }) => ({
        factId: row.id,
        factType: row.factType,
        value: bounded.value,
        status: row.status,
        approvalStatus: row.approvalStatus,
        sourceSystem: row.sourceSystem,
      })),
      review: {
        openIdentityReviews: profile.reviews.openCount,
        candidateFacts: profile.facts.candidateCount,
        conflictingFacts: profile.facts.conflictingCount,
      },
    },
  );
}

async function openJobs(
  world: ContinuumAgentWorld,
  raw: UnknownRequest,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<{ jobs: AgentOpenJob[] }>> {
  const requestedProjectId = cleanText(raw.projectId);
  const limit = boundedLimit(raw.limit, MAX_OPEN_JOBS, MAX_OPEN_JOBS);
  const listed = requestedProjectId
    ? [{ projectId: requestedProjectId, title: "" }]
    : (await world.listProjects()).slice(0, MAX_PROJECTS);
  const [desks, projectless] = await Promise.all([
    Promise.all(listed.map(async (row) => ({
      summary: row,
      result: await world.getProjectDesk(row.projectId),
    }))),
    requestedProjectId ? Promise.resolve([]) : world.listProjectlessJobs(),
  ]);
  if (requestedProjectId && !desks[0]?.result.ok) {
    return failed(
      metadata({ requestId, operation: "get_open_jobs", now }),
      "not_found",
      "Project was not found.",
    );
  }
  const reasons: string[] = [];
  const all: AgentOpenJob[] = [];
  for (const row of desks) {
    if (!row.result.ok) continue;
    if (!row.result.desk.openJobs.connected) {
      reasons.push("open_jobs_not_connected");
      continue;
    }
    for (const job of row.result.desk.openJobs.unresolved) {
      if (job.waitingOnActor === "unknown") reasons.push("job_owner_unknown");
      all.push({
        jobId: job.jobId,
        projectId: row.result.desk.projectId,
        projectTitle: row.result.desk.title,
        kind: job.kind,
        subject: job.subject,
        detail: job.detail,
        waitingOn: job.waitingOnActor,
        state: job.state,
        dueAt: job.dueAt,
        deferredUntil: job.deferredUntil,
        associatedPersonId: job.associatedPersonId,
        associatedPersonName: job.associatedPersonName,
        sourceSystem: job.sourceSystem,
      });
    }
  }
  if (projectless == null) {
    reasons.push("open_jobs_not_connected");
  } else {
    const projectlessOpen = deskJobsFromCanonical(
      sortProjectJobs(projectless),
      [],
    );
    for (const job of projectlessOpen) {
      if (job.waitingOnActor === "unknown") reasons.push("job_owner_unknown");
      all.push({
        jobId: job.jobId,
        projectId: null,
        projectTitle: null,
        kind: job.kind,
        subject: job.subject,
        detail: job.detail,
        waitingOn: job.waitingOnActor,
        state: job.state,
        dueAt: job.dueAt,
        deferredUntil: job.deferredUntil,
        associatedPersonId: job.associatedPersonId,
        associatedPersonName: job.associatedPersonName,
        sourceSystem: job.sourceSystem,
      });
    }
  }
  const jobs = all.slice(0, limit);
  return succeeded(
    metadata({
      requestId,
      operation: "get_open_jobs",
      now,
      truncated: all.length > jobs.length || (!requestedProjectId && listed.length === MAX_PROJECTS),
      reasons,
      provenance: jobs.map((row) => ({
        kind: "project_job",
        id: row.jobId,
        sourceSystem: row.sourceSystem,
      })),
    }),
    { jobs },
  );
}

const WAITING_GROUPS = {
  founder: new Set(["your_turn"]),
  client: new Set(["waiting_for_client"]),
  shop: new Set(["waiting_on_shop"]),
  production: new Set(["in_production"]),
} as const;

async function waitingOn(
  world: ContinuumAgentWorld,
  raw: UnknownRequest,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<AgentWaitingOn>> {
  const party = cleanText(raw.party) || "all";
  if (!(party === "all" || Object.prototype.hasOwnProperty.call(WAITING_GROUPS, party))) {
    return failed(
      metadata({ requestId, operation: "get_waiting_on", now }),
      "invalid_request",
      "Unsupported waiting party.",
    );
  }
  const source = await world.groupCurrentProjects(now.toISOString());
  const allowed = party === "all" ? null : WAITING_GROUPS[party as keyof typeof WAITING_GROUPS];
  let remaining = MAX_PROJECTS;
  let total = 0;
  const provenance: AgentContractProvenance[] = [];
  const groups = source.filter((group) => allowed == null || allowed.has(group.id as never)).map((group) => {
    total += group.projects.length;
    const selected = group.projects.slice(0, remaining);
    remaining -= selected.length;
    for (const row of selected) provenance.push({ kind: "project", id: row.projectId });
    return {
      id: group.id,
      label: group.label,
      projects: selected.map((row) => ({
        projectId: row.projectId,
        title: row.title,
        detail: row.currentAction.detail,
        since: row.waitingSince,
      })),
    };
  }).filter((group) => group.projects.length > 0);
  return succeeded(
    metadata({
      requestId,
      operation: "get_waiting_on",
      now,
      truncated: total > MAX_PROJECTS,
      provenance,
    }),
    { groups },
  );
}

async function commitments(
  world: ContinuumAgentWorld,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<AgentCommitments>> {
  const groups = await world.groupCurrentProjects(now.toISOString());
  const source = groups.find((row) => row.id === "your_turn")?.projects ?? [];
  const selected = source.slice(0, MAX_PROJECTS);
  return succeeded(
    metadata({
      requestId,
      operation: "get_commitments",
      now,
      truncated: source.length > selected.length,
      provenance: selected.map((row) => ({ kind: "project", id: row.projectId })),
    }),
    {
      projects: selected.map((row) => ({
        projectId: row.projectId,
        title: row.title,
        detail: row.currentAction.detail,
        dueAt: row.actionDueAt,
      })),
    },
  );
}

async function today(
  world: ContinuumAgentWorld,
  requestId: string,
  now: Date,
  operation: "get_today" | "get_next_three",
  requestedLimit: unknown,
): Promise<AgentContractResult<AgentToday>> {
  const limit = operation === "get_next_three" ? 3 : boundedLimit(requestedLimit, 5, 5);
  const source = await world.loadTodayItems(limit);
  const items = source.slice(0, limit);
  return succeeded(
    metadata({
      requestId,
      operation,
      now,
      truncated: source.length > items.length,
    }),
    { items },
  );
}

async function verifiedPerson(
  world: ContinuumAgentWorld,
  personId: string,
): Promise<{ ok: true; projectIds: Set<string> } | { ok: false; code: "not_found" | "needs_review" }> {
  const person = await world.getPersonProfile(personId);
  if (!person.ok) return { ok: false, code: "not_found" };
  if (personReviewReasons(person).length > 0) return { ok: false, code: "needs_review" };
  return {
    ok: true,
    projectIds: new Set(person.profile.projects.map((row) => row.profile.projectId)),
  };
}

async function validateProposalChange(
  world: ContinuumAgentWorld,
  change: AgentStateChangeProposal,
): Promise<{ ok: true; change: AgentStateChangeProposal; provenance: AgentContractProvenance[] } | {
  ok: false;
  code: "invalid_request" | "not_found" | "needs_review" | "operation_not_allowed" | "target_uncertain";
  message: string;
}> {
  if (!isRecord(change)) {
    return { ok: false, code: "invalid_request", message: "A structured change is required." };
  }
  if (change.kind === "set_project_spec") {
    const project = await world.getProjectDesk(cleanText(change.projectId));
    if (!project.ok) return { ok: false, code: "not_found", message: "Project was not found." };
    const parsed = validateProjectSpecCorrection(change.fieldName, change.proposedValue);
    if (!parsed.ok) {
      return { ok: false, code: "invalid_request", message: `Invalid project spec: ${parsed.reason}.` };
    }
    return {
      ok: true,
      change: { ...change, fieldName: parsed.field, proposedValue: parsed.value },
      provenance: [{ kind: "project", id: project.desk.projectId }],
    };
  }
  if (change.kind === "create_open_job") {
    const project = await world.getProjectDesk(cleanText(change.projectId));
    if (!project.ok) return { ok: false, code: "not_found", message: "Project was not found." };
    const subject = parseOpenJobSubject(change.subject);
    const detail = parseOpenJobDetail(change.detail);
    const due = parseOptionalDue(change.dueAt);
    if (
      !isOpenJobKind(change.jobKind) ||
      !isOpenJobActor(change.waitingOnActor) ||
      !subject.ok ||
      !detail.ok ||
      !due.ok
    ) {
      return { ok: false, code: "invalid_request", message: "Open Job fields failed canonical validation." };
    }
    const provenance: AgentContractProvenance[] = [{ kind: "project", id: project.desk.projectId }];
    const associatedPersonId = cleanText(change.associatedPersonId) || null;
    if (associatedPersonId) {
      const person = await verifiedPerson(world, associatedPersonId);
      if (!person.ok) {
        return {
          ok: false,
          code: person.code,
          message: person.code === "needs_review" ? "Person identity requires review." : "Person was not found.",
        };
      }
      if (!person.projectIds.has(project.desk.projectId)) {
        return {
          ok: false,
          code: "target_uncertain",
          message: "Person is not canonically linked to the target Project.",
        };
      }
      provenance.push({ kind: "person", id: associatedPersonId });
    }
    return {
      ok: true,
      change: {
        ...change,
        projectId: project.desk.projectId,
        subject: subject.subject,
        detail: detail.detail,
        associatedPersonId,
        dueAt: due.value,
      },
      provenance,
    };
  }
  if (change.kind === "add_person_note") {
    const personId = cleanText(change.personId);
    const person = await verifiedPerson(world, personId);
    if (!person.ok) {
      return {
        ok: false,
        code: person.code,
        message: person.code === "needs_review" ? "Person identity requires review." : "Person was not found.",
      };
    }
    const noteText = cleanText(change.noteText);
    if (!noteText || noteText.length > MAX_AGENT_NOTE || noteText.includes("\u0000")) {
      return { ok: false, code: "invalid_request", message: "Note failed canonical length validation." };
    }
    const projectId = cleanText(change.projectId) || null;
    if (projectId && !person.projectIds.has(projectId)) {
      return {
        ok: false,
        code: "target_uncertain",
        message: "Person is not canonically linked to the target Project.",
      };
    }
    if (projectId && !(await world.getProjectDesk(projectId)).ok) {
      return { ok: false, code: "not_found", message: "Project was not found." };
    }
    return {
      ok: true,
      change: { ...change, personId, projectId, noteText },
      provenance: [
        { kind: "person", id: personId },
        ...(projectId ? [{ kind: "project" as const, id: projectId }] : []),
      ],
    };
  }
  return { ok: false, code: "operation_not_allowed", message: "Unsupported state change." };
}

async function propose(
  world: ContinuumAgentWorld,
  raw: UnknownRequest,
  requestId: string,
  now: Date,
): Promise<AgentContractResult<AgentProposalReceipt>> {
  const base = metadata({ requestId, operation: "propose_state_change", now });
  if (!isRecord(raw.provenance)) {
    return failed(base, "provenance_required", "Structured provenance is required.");
  }
  const sourceSystem = cleanText(raw.provenance.sourceSystem);
  const sourceRef = cleanText(raw.provenance.sourceRef);
  if (
    !(CANDIDATE_SOURCE_SYSTEMS as readonly string[]).includes(sourceSystem) ||
    !sourceRef ||
    sourceRef.length > CANDIDATE_SOURCE_REF_MAX ||
    /[\r\n]/.test(sourceRef)
  ) {
    return failed(base, "provenance_required", "Recognized, bounded source provenance is required.");
  }
  const observedAt = parseOptionalIso(cleanText(raw.provenance.observedAt) || null);
  if (!observedAt.ok) {
    return failed(base, "invalid_request", "observedAt must be an ISO timestamp.");
  }
  const checked = await validateProposalChange(
    world,
    raw.change as AgentStateChangeProposal,
  );
  if (!checked.ok) return failed(base, checked.code, checked.message);
  const provenance = {
    sourceSystem: sourceSystem as AgentProposalRequest["provenance"]["sourceSystem"],
    sourceRef,
    observedAt: observedAt.value,
  };
  return succeeded(
    metadata({
      requestId,
      operation: "propose_state_change",
      now,
      reasons: ["founder_approval_required"],
      provenance: [
        ...checked.provenance,
        { kind: "source", id: sourceRef, sourceSystem },
      ],
    }),
    {
      proposalId: `agent-proposal:${requestId}`,
      persist: false,
      canonical: false,
      automaticApply: false,
      reviewStatus: "needs_review",
      requiresFounderApproval: true,
      approvedMutation: null,
      change: checked.change,
      provenance,
      approvalPath: "existing-founder-review",
    },
  );
}

export async function executeContinuumAgentContract(
  world: ContinuumAgentWorld,
  request: AgentContractRequest | UnknownRequest,
  now = new Date(),
): Promise<AgentContractResult<AgentContractData>> {
  const raw = (isRecord(request) ? request : {}) as UnknownRequest;
  const requestId = cleanText(raw.requestId);
  const operation = operationOf(raw.operation);
  const safeRequestId = requestId || "invalid-request";
  const base = metadata({ requestId: safeRequestId, operation, now });
  if (!requestId || requestId.length > MAX_REQUEST_ID || /[\r\n]/.test(requestId)) {
    return failed(base, "invalid_request", "A bounded requestId is required.");
  }
  if (operation === "unsupported") {
    return failed(base, "operation_not_allowed", "The requested operation is outside this contract.");
  }
  try {
    switch (operation) {
      case "get_current_truth":
        return currentTruth(world, requestId, now);
      case "get_client_context":
        return clientContext(world, raw, requestId, now);
      case "get_open_jobs":
        return openJobs(world, raw, requestId, now);
      case "get_waiting_on":
        return waitingOn(world, raw, requestId, now);
      case "get_commitments":
        return commitments(world, requestId, now);
      case "get_today":
        return today(world, requestId, now, operation, raw.limit);
      case "get_next_three":
        return today(world, requestId, now, operation, 3);
      case "propose_state_change":
        return propose(world, raw, requestId, now);
    }
  } catch {
    return failed(base, "unavailable", "Continuum could not satisfy the contract request.");
  }
}
