import {
  STERLING_ATTENTION_PRIORITIES, STERLING_MUTATION_KINDS, STERLING_RELATIONSHIP_PROPOSAL_KINDS, STERLING_RELATIONSHIP_ROLES, STERLING_RESPONSIBLE_PARTIES,
  STERLING_TODAY_CATEGORIES, STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal,
} from "./types";
import { CUSTOM_LIFECYCLE_STAGES, REPAIR_LIFECYCLE_STAGES } from "@/lib/continuum/client-memory/project-lifecycle";

const nullableString = { type: ["string", "null"] } as const;
const lifecycleStages = [...new Set([...CUSTOM_LIFECYCLE_STAGES, ...REPAIR_LIFECYCLE_STAGES])];
const nullableLifecycleStage = { type: ["string", "null"], enum: [...lifecycleStages, null] } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;
const confidence = { type: "string", enum: ["high", "medium", "low"] } as const;
const responsibleParty = { type: "string", enum: STERLING_RESPONSIBLE_PARTIES } as const;
const attentionPriority = { type: "string", enum: STERLING_ATTENTION_PRIORITIES } as const;
const obligation = {
  type: "object", additionalProperties: false,
  properties: { obligationId: { type: "string" }, description: { type: "string" },
    status: { type: "string", enum: ["open", "fulfilled", "superseded", "ambiguous"] },
    responsibleParty, confidence, evidenceRefs: stringArray },
  required: ["obligationId", "description", "status", "responsibleParty", "confidence", "evidenceRefs"],
} as const;
const stageAssessment = {
  type: "object", additionalProperties: false,
  properties: { canonicalLifecycleStage: nullableLifecycleStage, operationalSubstage: nullableString,
    responsibleParty, confidence, explanation: { type: "string" }, evidenceRefs: stringArray },
  required: ["canonicalLifecycleStage", "operationalSubstage", "responsibleParty", "confidence", "explanation", "evidenceRefs"],
} as const;
const portfolioAssessment = {
  type: "object", additionalProperties: false,
  properties: {
    workUnitId: { type: "string" }, projectId: nullableString,
    identityStatus: { type: "string", enum: ["canonical_project", "provisional_evidence", "unresolved_identity"] },
    todayDisposition: { type: "string", enum: ["presented", "suppressed", "ambiguous"] },
    recommendationItemId: nullableString,
    currentStage: stageAssessment,
    obligations: { type: "array", items: obligation },
    nextStepOwner: responsibleParty, attentionPriority, confidence, evidenceRefs: stringArray, ambiguities: stringArray,
    explanation: { type: "string" }, omissionReason: nullableString,
  },
  required: ["workUnitId", "projectId", "identityStatus", "todayDisposition", "recommendationItemId",
    "currentStage", "obligations", "nextStepOwner", "attentionPriority", "confidence", "evidenceRefs", "ambiguities",
    "explanation", "omissionReason"],
} as const;
const recommendation = {
  type: "object", additionalProperties: false,
  properties: {
    itemId: { type: "string" }, workUnitId: { type: "string" }, category: { type: "string", enum: STERLING_TODAY_CATEGORIES },
    projectId: nullableString, personId: nullableString,
    relationshipRole: { type: "string", enum: STERLING_RELATIONSHIP_ROLES }, title: { type: "string" },
    summary: { type: "string" }, attentionPriority, confidence, explanation: { type: "string" },
    evidenceRefs: stringArray, ambiguities: stringArray,
    obligations: { type: "array", items: obligation },
  },
  required: ["itemId", "workUnitId", "category", "projectId", "personId", "relationshipRole", "title", "summary",
    "attentionPriority", "confidence", "explanation", "evidenceRefs", "ambiguities", "obligations"],
} as const;
const mutation = {
  type: "object", additionalProperties: false,
  properties: {
    proposalKey: { type: "string" }, kind: { type: "string", enum: STERLING_MUTATION_KINDS },
    projectId: nullableString, personId: nullableString, jobId: nullableString,
    expectedRecordVersion: nullableString, targetLifecycleStage: nullableLifecycleStage,
    targetJobState: { type: ["string", "null"], enum: ["resolved", "cancelled", null] },
    targetResponsibleParty: { type: ["string", "null"], enum: [...STERLING_RESPONSIBLE_PARTIES, null] },
    newJob: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false,
      properties: { kind: { type: "string" }, subject: { type: "string" }, detail: nullableString,
        responsibleParty, dueAt: nullableString },
      required: ["kind", "subject", "detail", "responsibleParty", "dueAt"] }] },
    reason: { type: "string" }, evidenceRefs: stringArray,
    requiresFounderApproval: { type: "boolean", const: true },
  },
  required: ["proposalKey", "kind", "projectId", "personId", "jobId", "expectedRecordVersion",
    "targetLifecycleStage", "targetJobState", "targetResponsibleParty", "newJob", "reason",
    "evidenceRefs", "requiresFounderApproval"],
} as const;
const relationshipProposal = {
  type: "object", additionalProperties: false,
  properties: {
    proposalKey: { type: "string" }, kind: { type: "string", enum: STERLING_RELATIONSHIP_PROPOSAL_KINDS },
    workUnitId: { type: "string" }, personId: nullableString, projectId: nullableString,
    threadIds: stringArray,
    basis: { type: "string", enum: ["exact_sender_identity", "historical_thread_continuity", "exact_operational_identifier", "canonical_source_record"] },
    confidence, reason: { type: "string" }, evidenceRefs: stringArray,
    requiresFounderApproval: { type: "boolean", const: true },
  },
  required: ["proposalKey", "kind", "workUnitId", "personId", "projectId", "threadIds", "basis", "confidence",
    "reason", "evidenceRefs", "requiresFounderApproval"],
} as const;

export const STERLING_TODAY_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    contractVersion: { type: "string", const: STERLING_TODAY_PROPOSAL_VERSION },
    runId: { type: "string" }, evidenceSnapshotId: { type: "string" }, generatedAt: { type: "string" },
    portfolioAssessments: { type: "array", items: portfolioAssessment },
    recommendations: { type: "array", items: recommendation },
    relationshipProposals: { type: "array", items: relationshipProposal },
    proposedCanonicalMutations: { type: "array", items: mutation }, portfolioAmbiguities: stringArray,
  },
  required: ["contractVersion", "runId", "evidenceSnapshotId", "generatedAt", "portfolioAssessments", "recommendations",
    "relationshipProposals", "proposedCanonicalMutations", "portfolioAmbiguities"],
} as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === "string"); }
function nullable(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function oneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
function validObligation(v: unknown): boolean {
  return record(v) && typeof v.obligationId === "string" && typeof v.description === "string" &&
    oneOf(v.status, ["open", "fulfilled", "superseded", "ambiguous"] as const) &&
    oneOf(v.responsibleParty, STERLING_RESPONSIBLE_PARTIES) && oneOf(v.confidence, ["high", "medium", "low"] as const) && strings(v.evidenceRefs);
}
function validStageAssessment(v: unknown): boolean {
  return record(v) && (v.canonicalLifecycleStage === null || oneOf(v.canonicalLifecycleStage, lifecycleStages)) &&
    nullable(v.operationalSubstage) && oneOf(v.responsibleParty, STERLING_RESPONSIBLE_PARTIES) &&
    oneOf(v.confidence, ["high", "medium", "low"] as const) && typeof v.explanation === "string" && strings(v.evidenceRefs);
}
function validPortfolioAssessment(v: unknown): boolean {
  return record(v) && typeof v.workUnitId === "string" && nullable(v.projectId) &&
    oneOf(v.identityStatus, ["canonical_project", "provisional_evidence", "unresolved_identity"] as const) &&
    oneOf(v.todayDisposition, ["presented", "suppressed", "ambiguous"] as const) && nullable(v.recommendationItemId) &&
    validStageAssessment(v.currentStage) && Array.isArray(v.obligations) && v.obligations.every(validObligation) &&
    oneOf(v.nextStepOwner, STERLING_RESPONSIBLE_PARTIES) && oneOf(v.attentionPriority, STERLING_ATTENTION_PRIORITIES) &&
    oneOf(v.confidence, ["high", "medium", "low"] as const) &&
    strings(v.evidenceRefs) && strings(v.ambiguities) && typeof v.explanation === "string" && nullable(v.omissionReason);
}
function validRecommendation(v: unknown): boolean {
  if (!record(v)) return false;
  return !("projectStage" in v) && !("responsibleParty" in v) &&
    typeof v.itemId === "string" && typeof v.workUnitId === "string" &&
    oneOf(v.category, STERLING_TODAY_CATEGORIES) && nullable(v.projectId) &&
    nullable(v.personId) && oneOf(v.relationshipRole, STERLING_RELATIONSHIP_ROLES) && typeof v.title === "string" &&
    typeof v.summary === "string" && oneOf(v.attentionPriority, STERLING_ATTENTION_PRIORITIES) &&
    oneOf(v.confidence, ["high", "medium", "low"] as const) && typeof v.explanation === "string" &&
    strings(v.evidenceRefs) && strings(v.ambiguities) &&
    Array.isArray(v.obligations) && v.obligations.every(validObligation);
}
function validMutation(v: unknown): boolean {
  if (!record(v)) return false;
  const n = v.newJob;
  const validNew = n === null || (record(n) && typeof n.kind === "string" && typeof n.subject === "string" &&
    nullable(n.detail) && oneOf(n.responsibleParty, STERLING_RESPONSIBLE_PARTIES) && nullable(n.dueAt));
  return typeof v.proposalKey === "string" && oneOf(v.kind, STERLING_MUTATION_KINDS) && nullable(v.projectId) &&
    nullable(v.personId) && nullable(v.jobId) && nullable(v.expectedRecordVersion) &&
    (v.targetLifecycleStage === null || oneOf(v.targetLifecycleStage, lifecycleStages)) &&
    (v.targetJobState === null || v.targetJobState === "resolved" || v.targetJobState === "cancelled") &&
    (v.targetResponsibleParty === null || oneOf(v.targetResponsibleParty, STERLING_RESPONSIBLE_PARTIES)) && validNew &&
    typeof v.reason === "string" && strings(v.evidenceRefs) && v.requiresFounderApproval === true;
}
function validRelationshipProposal(v: unknown): boolean {
  return record(v) && typeof v.proposalKey === "string" && oneOf(v.kind, STERLING_RELATIONSHIP_PROPOSAL_KINDS) &&
    typeof v.workUnitId === "string" && nullable(v.personId) && nullable(v.projectId) && strings(v.threadIds) &&
    oneOf(v.basis, ["exact_sender_identity", "historical_thread_continuity", "exact_operational_identifier", "canonical_source_record"] as const) &&
    oneOf(v.confidence, ["high", "medium", "low"] as const) && typeof v.reason === "string" &&
    strings(v.evidenceRefs) && v.requiresFounderApproval === true;
}

export function parseSterlingTodayProposal(value: unknown): SterlingTodayProposal | null {
  if (!record(value) || value.contractVersion !== STERLING_TODAY_PROPOSAL_VERSION || typeof value.runId !== "string" ||
      typeof value.evidenceSnapshotId !== "string" || typeof value.generatedAt !== "string" ||
      !Array.isArray(value.portfolioAssessments) || !value.portfolioAssessments.every(validPortfolioAssessment) ||
      !Array.isArray(value.recommendations) || !value.recommendations.every(validRecommendation) ||
      !Array.isArray(value.relationshipProposals) || !value.relationshipProposals.every(validRelationshipProposal) ||
      !Array.isArray(value.proposedCanonicalMutations) || !value.proposedCanonicalMutations.every(validMutation) ||
      !strings(value.portfolioAmbiguities)) return null;
  return value as unknown as SterlingTodayProposal;
}
