/**
 * Future Brain Gate plug-in. #17 stays deterministic — no live model calls.
 * Later slices may attach a reasoner; this gate refuses provider SDKs.
 */

import type { ContinuumCandidateDraft } from "./types";

export const DETERMINISTIC_CANDIDATE_BRAIN_GATE_ID =
  "continuum-candidates-deterministic-v1" as const;

export type CandidateReasonerInput = {
  sourceSystem: string;
  text: string;
  sourceTimestamp: string;
};

export type CandidateReasoner = {
  readonly reasonerId: string;
  propose(input: CandidateReasonerInput): readonly ContinuumCandidateDraft[];
};

export type CandidateBrainGate = {
  readonly gateId: typeof DETERMINISTIC_CANDIDATE_BRAIN_GATE_ID;
  readonly liveModelCalls: false;
  readonly providerSdk: null;
  reasoner: CandidateReasoner | null;
};

export const DETERMINISTIC_CANDIDATE_BRAIN_GATE: CandidateBrainGate = {
  gateId: DETERMINISTIC_CANDIDATE_BRAIN_GATE_ID,
  liveModelCalls: false,
  providerSdk: null,
  reasoner: null,
};

export function isLiveCandidateReasoningEnabled(
  gate: CandidateBrainGate = DETERMINISTIC_CANDIDATE_BRAIN_GATE,
): false {
  void gate.reasoner;
  return false;
}
