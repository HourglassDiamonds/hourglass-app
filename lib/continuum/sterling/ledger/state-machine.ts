import type { SterlingProposalStatus } from "./types";

const TRANSITIONS: Readonly<Record<SterlingProposalStatus, readonly SterlingProposalStatus[]>> = {
  proposed: ["approved", "edited_and_approved", "rejected", "deferred", "superseded"],
  deferred: ["approved", "edited_and_approved", "rejected", "deferred", "superseded"],
  approved: ["executing", "superseded"],
  edited_and_approved: ["executing", "superseded"],
  executing: ["executed", "failed", "superseded"],
  failed: ["executing", "superseded"],
  rejected: [],
  executed: [],
  superseded: [],
};

export function canTransitionSterlingProposal(
  from: SterlingProposalStatus,
  to: SterlingProposalStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isActiveSterlingProposal(status: SterlingProposalStatus): boolean {
  return ["proposed", "deferred", "approved", "edited_and_approved", "executing", "failed"].includes(status);
}

export function isTerminalSterlingProposal(status: SterlingProposalStatus): boolean {
  return status === "rejected" || status === "executed" || status === "superseded";
}
