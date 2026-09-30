import type { CandidateSourceSystem } from "@/lib/continuum/candidates/types";
import type { ContinuumJsonValue } from "@/lib/continuum/contracts/types";
import type {
  OpenJobActor,
  OpenJobKind,
} from "@/lib/continuum/client-memory/project-jobs/types";
import type { EditableProjectSpecField } from "@/lib/continuum/client-memory/project-spec/types";

export const CONTINUUM_AGENT_CONTRACT_VERSION =
  "continuum-agent-contracts-v1" as const;

export const CONTINUUM_AGENT_READ_OPERATIONS = [
  "get_current_truth",
  "get_client_context",
  "get_open_jobs",
  "get_waiting_on",
  "get_commitments",
  "get_today",
  "get_next_three",
] as const;

export type ContinuumAgentReadOperation =
  (typeof CONTINUUM_AGENT_READ_OPERATIONS)[number];

export const CONTINUUM_AGENT_CAPABILITIES = {
  read: "allowed",
  proposal: "proposal-only",
  approvedMutation: "not-exposed",
} as const;

export type AgentContractReview = {
  status: "clear" | "needs_review";
  reasons: string[];
};

export type AgentContractProvenance = {
  kind: "person" | "project" | "project_job" | "candidate" | "source";
  id: string;
  sourceSystem?: string | null;
};

export type AgentContractMetadata = {
  contractVersion: typeof CONTINUUM_AGENT_CONTRACT_VERSION;
  requestId: string;
  operation: ContinuumAgentReadOperation | "propose_state_change" | "unsupported";
  capability: "read" | "proposal";
  asOf: string;
  truncated: boolean;
  review: AgentContractReview;
  provenance: AgentContractProvenance[];
};

export type AgentContractErrorCode =
  | "ambiguous_identity"
  | "invalid_request"
  | "needs_review"
  | "not_found"
  | "operation_not_allowed"
  | "provenance_required"
  | "target_uncertain"
  | "unavailable";

export type AgentContractSuccess<T> = AgentContractMetadata & {
  ok: true;
  data: T;
};

export type AgentContractFailure = AgentContractMetadata & {
  ok: false;
  error: {
    code: AgentContractErrorCode;
    message: string;
  };
};

export type AgentContractResult<T> =
  | AgentContractSuccess<T>
  | AgentContractFailure;

export type AgentCurrentTruthProject = {
  projectId: string;
  title: string;
  state: string;
  currentAction: string | null;
  lifecycleStage: string | null;
  dueAt: string | null;
};

export type AgentCurrentTruth = {
  groups: Array<{
    id: string;
    label: string;
    projects: AgentCurrentTruthProject[];
  }>;
};

export type AgentClientContext = {
  person: {
    personId: string;
    displayName: string;
    organizationName: string | null;
    roles: string[];
  };
  projects: Array<{
    projectId: string;
    title: string;
    projectKind: string | null;
    cadJobNumber: string | null;
    orderNumber: string | null;
  }>;
  facts: Array<{
    factId: string;
    factType: string;
    value: ContinuumJsonValue;
    status: string;
    approvalStatus: string;
    sourceSystem: string;
  }>;
  review: {
    openIdentityReviews: number;
    candidateFacts: number;
    conflictingFacts: number;
  };
};

export type AgentOpenJob = {
  jobId: string;
  projectId: string;
  projectTitle: string;
  kind: OpenJobKind;
  subject: string;
  detail: string | null;
  waitingOn: OpenJobActor;
  state: "open" | "snoozed";
  dueAt: string | null;
  deferredUntil: string | null;
  associatedPersonId: string | null;
  associatedPersonName: string | null;
  sourceSystem: string;
};

export type AgentWaitingOn = {
  groups: Array<{
    id: string;
    label: string;
    projects: Array<{
      projectId: string;
      title: string;
      detail: string | null;
      since: string | null;
    }>;
  }>;
};

export type AgentCommitments = {
  projects: Array<{
    projectId: string;
    title: string;
    detail: string | null;
    dueAt: string | null;
  }>;
};

export type AgentToday = {
  items: Array<{
    title: string;
    detail: string;
    projectTitle: string | null;
    personName: string | null;
  }>;
};

export type AgentContractReadRequest =
  | { requestId: string; operation: "get_current_truth" }
  | {
      requestId: string;
      operation: "get_client_context";
      personId?: string;
      query?: string;
    }
  | {
      requestId: string;
      operation: "get_open_jobs";
      projectId?: string;
      limit?: number;
    }
  | {
      requestId: string;
      operation: "get_waiting_on";
      party?: "all" | "founder" | "client" | "shop" | "production";
    }
  | { requestId: string; operation: "get_commitments" }
  | { requestId: string; operation: "get_today"; limit?: number }
  | { requestId: string; operation: "get_next_three" };

export type AgentProposalProvenance = {
  sourceSystem: CandidateSourceSystem;
  sourceRef: string;
  observedAt?: string | null;
};

export type AgentStateChangeProposal =
  | {
      kind: "set_project_spec";
      projectId: string;
      fieldName: EditableProjectSpecField;
      proposedValue: string;
    }
  | {
      kind: "create_open_job";
      projectId: string;
      jobKind: OpenJobKind;
      subject: string;
      detail?: string | null;
      waitingOnActor: OpenJobActor;
      associatedPersonId?: string | null;
      dueAt?: string | null;
    }
  | {
      kind: "add_person_note";
      personId: string;
      projectId?: string | null;
      noteText: string;
    };

export type AgentProposalRequest = {
  requestId: string;
  operation: "propose_state_change";
  change: AgentStateChangeProposal;
  provenance: AgentProposalProvenance;
};

export type AgentProposalReceipt = {
  proposalId: string;
  persist: false;
  canonical: false;
  automaticApply: false;
  reviewStatus: "needs_review";
  requiresFounderApproval: true;
  approvedMutation: null;
  change: AgentStateChangeProposal;
  provenance: AgentProposalProvenance;
  approvalPath: "existing-founder-review";
};

export type AgentContractRequest =
  | AgentContractReadRequest
  | AgentProposalRequest;
