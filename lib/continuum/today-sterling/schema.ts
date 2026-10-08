import {
  STERLING_MUTATION_KINDS, STERLING_RELATIONSHIP_ROLES, STERLING_RESPONSIBLE_PARTIES,
  STERLING_TODAY_CATEGORIES, STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal,
} from "./types";

const nullableString = { type: ["string", "null"] } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;
const confidence = { type: "string", enum: ["high", "medium", "low"] } as const;
const responsibleParty = { type: "string", enum: STERLING_RESPONSIBLE_PARTIES } as const;
const obligation = {
  type: "object", additionalProperties: false,
  properties: { obligationId: { type: "string" }, description: { type: "string" },
    status: { type: "string", enum: ["open", "fulfilled", "superseded", "ambiguous"] },
    responsibleParty, confidence, evidenceRefs: stringArray },
  required: ["obligationId", "description", "status", "responsibleParty", "confidence", "evidenceRefs"],
} as const;
const recommendation = {
  type: "object", additionalProperties: false,
  properties: {
    itemId: { type: "string" }, category: { type: "string", enum: STERLING_TODAY_CATEGORIES },
    projectId: nullableString, personId: nullableString,
    relationshipRole: { type: "string", enum: STERLING_RELATIONSHIP_ROLES }, title: { type: "string" },
    summary: { type: "string" }, responsibleParty, confidence, explanation: { type: "string" },
    evidenceRefs: stringArray, ambiguities: stringArray,
    projectStage: { type: "object", additionalProperties: false,
      properties: { stage: nullableString, confidence, explanation: { type: "string" }, evidenceRefs: stringArray },
      required: ["stage", "confidence", "explanation", "evidenceRefs"] },
    obligations: { type: "array", items: obligation },
  },
  required: ["itemId", "category", "projectId", "personId", "relationshipRole", "title", "summary",
    "responsibleParty", "confidence", "explanation", "evidenceRefs", "ambiguities", "projectStage", "obligations"],
} as const;
const mutation = {
  type: "object", additionalProperties: false,
  properties: {
    proposalKey: { type: "string" }, kind: { type: "string", enum: STERLING_MUTATION_KINDS },
    projectId: nullableString, personId: nullableString, jobId: nullableString,
    expectedRecordVersion: nullableString, targetLifecycleStage: nullableString,
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

export const STERLING_TODAY_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    contractVersion: { type: "string", const: STERLING_TODAY_PROPOSAL_VERSION },
    runId: { type: "string" }, evidenceSnapshotId: { type: "string" }, generatedAt: { type: "string" },
    recommendations: { type: "array", items: recommendation },
    proposedCanonicalMutations: { type: "array", items: mutation }, portfolioAmbiguities: stringArray,
  },
  required: ["contractVersion", "runId", "evidenceSnapshotId", "generatedAt", "recommendations",
    "proposedCanonicalMutations", "portfolioAmbiguities"],
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
function validRecommendation(v: unknown): boolean {
  if (!record(v) || !record(v.projectStage)) return false;
  return typeof v.itemId === "string" && oneOf(v.category, STERLING_TODAY_CATEGORIES) && nullable(v.projectId) &&
    nullable(v.personId) && oneOf(v.relationshipRole, STERLING_RELATIONSHIP_ROLES) && typeof v.title === "string" &&
    typeof v.summary === "string" && oneOf(v.responsibleParty, STERLING_RESPONSIBLE_PARTIES) &&
    oneOf(v.confidence, ["high", "medium", "low"] as const) && typeof v.explanation === "string" &&
    strings(v.evidenceRefs) && strings(v.ambiguities) && nullable(v.projectStage.stage) &&
    oneOf(v.projectStage.confidence, ["high", "medium", "low"] as const) &&
    typeof v.projectStage.explanation === "string" && strings(v.projectStage.evidenceRefs) &&
    Array.isArray(v.obligations) && v.obligations.every(validObligation);
}
function validMutation(v: unknown): boolean {
  if (!record(v)) return false;
  const n = v.newJob;
  const validNew = n === null || (record(n) && typeof n.kind === "string" && typeof n.subject === "string" &&
    nullable(n.detail) && oneOf(n.responsibleParty, STERLING_RESPONSIBLE_PARTIES) && nullable(n.dueAt));
  return typeof v.proposalKey === "string" && oneOf(v.kind, STERLING_MUTATION_KINDS) && nullable(v.projectId) &&
    nullable(v.personId) && nullable(v.jobId) && nullable(v.expectedRecordVersion) && nullable(v.targetLifecycleStage) &&
    (v.targetJobState === null || v.targetJobState === "resolved" || v.targetJobState === "cancelled") &&
    (v.targetResponsibleParty === null || oneOf(v.targetResponsibleParty, STERLING_RESPONSIBLE_PARTIES)) && validNew &&
    typeof v.reason === "string" && strings(v.evidenceRefs) && v.requiresFounderApproval === true;
}

export function parseSterlingTodayProposal(value: unknown): SterlingTodayProposal | null {
  if (!record(value) || value.contractVersion !== STERLING_TODAY_PROPOSAL_VERSION || typeof value.runId !== "string" ||
      typeof value.evidenceSnapshotId !== "string" || typeof value.generatedAt !== "string" ||
      !Array.isArray(value.recommendations) || !value.recommendations.every(validRecommendation) ||
      !Array.isArray(value.proposedCanonicalMutations) || !value.proposedCanonicalMutations.every(validMutation) ||
      !strings(value.portfolioAmbiguities)) return null;
  return value as unknown as SterlingTodayProposal;
}
