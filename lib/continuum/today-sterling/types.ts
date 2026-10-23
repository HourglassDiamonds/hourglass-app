/** Sterling-native Today V1 contracts. Sterling judges; Continuum validates. */
import type { ProjectLifecycleStage } from "@/lib/continuum/client-memory/project-lifecycle";

export const STERLING_TODAY_WORKING_SET_VERSION = "sterling-today-working-set-v3" as const;
export const STERLING_TODAY_PROPOSAL_VERSION = "sterling-today-proposal-v5" as const;

export const STERLING_TODAY_CATEGORIES = [
  "up_next", "founder_actions", "waiting_on_client", "waiting_on_shop",
  "in_production", "ready_delivery", "held_watching", "closed_or_superseded",
] as const;
export type SterlingTodayCategory = (typeof STERLING_TODAY_CATEGORIES)[number];

export const STERLING_RESPONSIBLE_PARTIES = [
  "founder", "client", "vendor_shop", "business_contact", "system", "unknown",
] as const;
export type SterlingResponsibleParty = (typeof STERLING_RESPONSIBLE_PARTIES)[number];

export const STERLING_RELATIONSHIP_ROLES = [
  "client", "prospect", "vendor_shop", "business_contact", "salesperson_solicitation",
  "calendar_only", "system_automation", "unknown",
] as const;
export type SterlingRelationshipRole = (typeof STERLING_RELATIONSHIP_ROLES)[number];
export type SterlingConfidence = "high" | "medium" | "low";

export type SterlingWorkingPerson = {
  personId: string; displayName: string; roles: readonly string[];
  organizationName: string | null; emailHashes: readonly string[];
};

export type SterlingWorkingProject = {
  projectId: string; title: string; projectKind: string | null;
  lifecycleStage: string | null; recordVersion: string;
  people: readonly { personId: string; relationshipRole: SterlingRelationshipRole }[];
  specs: readonly { fieldName: string; value: string }[];
  openJobIds: readonly string[]; gmailThreadIds: readonly string[];
};

export type SterlingWorkingJob = {
  jobId: string; projectId: string | null; associatedPersonId: string | null;
  kind: string; subject: string; detail: string | null;
  responsibleParty: SterlingResponsibleParty; state: string; dueAt: string | null;
  deferredUntil: string | null; sourceRef: string | null; recordVersion: string;
};

export type SterlingEvidence = {
  evidenceId: string; sourceType: "gmail" | "candidate" | "founder_directive" | "calendar" | "canonical";
  sourceRef: string; timestamp: string; direction: "inbound" | "outbound" | "unknown";
  subject: string | null; excerpt: string | null; attachmentFilenames: readonly string[];
  messageId: string | null; threadId: string | null; projectIds: readonly string[];
  personIds: readonly string[]; provenance: string;
};

export type SterlingPreviousTodayItem = {
  itemId: string; category: string; projectId: string | null; summary: string;
};

export type SterlingWorkingUnit = {
  workUnitId: string;
  kind: "canonical_project" | "provisional_evidence";
  identityBasis: "canonical_project" | "exact_identifier" | "source_thread" | "source_record" | "scoped_evidence_group";
  projectId: string | null;
  label: string;
  observedIdentifiers: readonly string[];
  typedIdentifiers: readonly { kind: "project" | "order" | "certificate" | "request" | "unknown"; value: string }[];
  threadIds: readonly string[];
  sourceRefs: readonly string[];
  evidenceRefs: readonly string[];
  /**
   * Request-local evidence bindings approved by a fixed server-owned target.
   * These never represent or persist a canonical Project/Gmail association.
   */
  targetThreadBindings?: readonly {
    threadId: string;
    associationBasis: "persisted_work_unit" | "server_reviewed_target";
    persistedCanonicalAssociation: boolean;
  }[];
};

export const STERLING_RELATIONSHIP_PROPOSAL_KINDS = [
  "associate_existing_person", "associate_thread_with_project",
] as const;
export type SterlingRelationshipProposalKind = (typeof STERLING_RELATIONSHIP_PROPOSAL_KINDS)[number];

export type SterlingRelationshipProposal = {
  proposalKey: string;
  kind: SterlingRelationshipProposalKind;
  workUnitId: string;
  personId: string | null;
  projectId: string | null;
  threadIds: readonly string[];
  basis: "exact_sender_identity" | "historical_thread_continuity" | "exact_operational_identifier" | "canonical_source_record";
  confidence: SterlingConfidence;
  reason: string;
  evidenceRefs: readonly string[];
  requiresFounderApproval: true;
};

export type SterlingTodayWorkingSet = {
  contractVersion: typeof STERLING_TODAY_WORKING_SET_VERSION;
  runId: string; evidenceSnapshotId: string; sourceWatermark: string; generatedAt: string;
  mutationMode: "shadow_read_only";
  people: readonly SterlingWorkingPerson[]; projects: readonly SterlingWorkingProject[];
  jobs: readonly SterlingWorkingJob[]; evidence: readonly SterlingEvidence[]; workUnits: readonly SterlingWorkingUnit[];
  calendarAvailability: { status: "available" | "unavailable" | "disabled"; reason: string | null };
  calendar: readonly { evidenceId: string; sourceRef: string; timeLabel: string; title: string; location: string | null; allDay: boolean; disclosure: "full" | "minimal" }[];
  previousToday: readonly SterlingPreviousTodayItem[];
};

export type SterlingObligationAssessment = {
  obligationId: string; description: string; status: "open" | "fulfilled" | "superseded" | "ambiguous";
  responsibleParty: SterlingResponsibleParty; confidence: SterlingConfidence; evidenceRefs: readonly string[];
};

export type SterlingPortfolioAssessment = {
  workUnitId: string;
  projectId: string | null;
  identityStatus: "canonical_project" | "provisional_evidence" | "unresolved_identity";
  todayDisposition: "presented" | "suppressed" | "ambiguous";
  recommendationItemId: string | null;
  currentStage: { canonicalLifecycleStage: ProjectLifecycleStage | null; operationalSubstage: string | null;
    responsibleParty: SterlingResponsibleParty; confidence: SterlingConfidence;
    explanation: string; evidenceRefs: readonly string[] };
  obligations: readonly SterlingObligationAssessment[];
  nextStepOwner: SterlingResponsibleParty;
  confidence: SterlingConfidence;
  evidenceRefs: readonly string[];
  ambiguities: readonly string[];
  explanation: string;
  omissionReason: string | null;
};

export type SterlingTodayRecommendation = {
  itemId: string; workUnitId: string; category: SterlingTodayCategory; projectId: string | null; personId: string | null;
  relationshipRole: SterlingRelationshipRole; title: string; summary: string;
  confidence: SterlingConfidence; explanation: string;
  evidenceRefs: readonly string[]; ambiguities: readonly string[];
  obligations: readonly SterlingObligationAssessment[];
};

export const STERLING_MUTATION_KINDS = [
  "set_project_lifecycle", "resolve_open_job", "cancel_open_job", "create_open_job", "update_open_job_holder",
] as const;
export type SterlingMutationKind = (typeof STERLING_MUTATION_KINDS)[number];

export type SterlingProposedCanonicalMutation = {
  proposalKey: string; kind: SterlingMutationKind; projectId: string | null; personId: string | null;
  jobId: string | null; expectedRecordVersion: string | null; targetLifecycleStage: ProjectLifecycleStage | null;
  targetJobState: "resolved" | "cancelled" | null; targetResponsibleParty: SterlingResponsibleParty | null;
  newJob: { kind: string; subject: string; detail: string | null; responsibleParty: SterlingResponsibleParty; dueAt: string | null } | null;
  reason: string; evidenceRefs: readonly string[]; requiresFounderApproval: true;
};

export type SterlingTodayProposal = {
  contractVersion: typeof STERLING_TODAY_PROPOSAL_VERSION; runId: string; evidenceSnapshotId: string;
  generatedAt: string; portfolioAssessments: readonly SterlingPortfolioAssessment[];
  recommendations: readonly SterlingTodayRecommendation[];
  relationshipProposals: readonly SterlingRelationshipProposal[];
  proposedCanonicalMutations: readonly SterlingProposedCanonicalMutation[]; portfolioAmbiguities: readonly string[];
};

export type SterlingMutationValidation = {
  proposalKey: string; validationId: string; status: "approved_for_founder_review" | "rejected";
  reasons: readonly string[]; rollback: string;
};

export type SterlingTodayValidationResult = {
  accepted: boolean; proposal: SterlingTodayProposal | null; errors: readonly string[];
  mutationValidations: readonly SterlingMutationValidation[];
};
