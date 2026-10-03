/** Narrow Sterling capability registry. No capability exposes SQL or a raw writer. */
export const STERLING_READ_CAPABILITIES = [
  "get_current_today",
  "get_open_jobs",
  "get_waiting_work",
  "get_project_context",
  "get_client_context",
  "get_recent_source_evidence",
  "get_quick_capture_proposals",
  "get_recent_founder_decisions",
] as const;

export const STERLING_PROPOSAL_CAPABILITIES = [
  "propose_job_update",
  "propose_priority_change",
  "propose_due_date",
  "propose_waiting_state",
  "propose_duplicate_merge",
  "propose_stale_resolution",
  "propose_new_projectless_job",
  "propose_follow_up",
] as const;

export type SterlingReadCapability = (typeof STERLING_READ_CAPABILITIES)[number];
export type SterlingProposalCapability = (typeof STERLING_PROPOSAL_CAPABILITIES)[number];

export const STERLING_TOOL_REGISTRY = [
  ...STERLING_READ_CAPABILITIES.map((name) => ({ name, mode: "read", canonicalWrite: false } as const)),
  ...STERLING_PROPOSAL_CAPABILITIES.map((name) => ({ name, mode: "proposal", canonicalWrite: false } as const)),
] as const;

export const STERLING_DIRECT_WRITE_CAPABILITIES: readonly never[] = [];
