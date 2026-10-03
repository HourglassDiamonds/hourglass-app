import type { SourceCommunicationSourceType } from "@/lib/continuum/source-events/types";

export const CONDITIONAL_HOLD_STATUSES = ["active", "condition_met", "resumed", "cancelled", "closed_terminal"] as const;
export type ConditionalHoldStatus = (typeof CONDITIONAL_HOLD_STATUSES)[number];
export type HoldScope = { projectId: string | null; personLabel: string | null; threadId: string | null; cadId: string | null };
export type ConditionalHoldCondition =
  | { kind: "until_time"; resumeAt: string; timezone: string }
  | { kind: "until_founder_contact"; scope: HoldScope; observableSources: readonly SourceCommunicationSourceType[] }
  | { kind: "until_external_reply"; scope: HoldScope; observableSources: readonly SourceCommunicationSourceType[] }
  | { kind: "until_source_event"; scope: HoldScope; semanticClass: "vendor_delivers_artifact"; observableSources: readonly SourceCommunicationSourceType[] }
  | { kind: "until_business_event"; event: string; observable: false };
export type ResumeEvidence = { sourceRef: string; observedAt: string; summary: string };
export type ConditionalHoldRecord = {
  holdId: string; entityType: "job"; entityId: string; projectId: string | null;
  createdAt: string; createdBy: string; reason: string; condition: ConditionalHoldCondition;
  sourceRefs: readonly string[]; approvalProposalId: string; provenance: "sterling-founder-approved";
  activatedAt: string; expectedEntityUpdatedAt: string; currentStateFingerprint: string;
  status: ConditionalHoldStatus; conditionMetAt: string | null; resumedAt: string | null; resumeEvidence: ResumeEvidence | null;
};
export type CreateConditionalHoldInput = Omit<ConditionalHoldRecord, "status" | "conditionMetAt" | "resumedAt" | "resumeEvidence">;
export interface ConditionalHoldRepository {
  create(input: CreateConditionalHoldInput): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
  get(holdId: string): Promise<ConditionalHoldRecord | null>;
  listActive(): Promise<ConditionalHoldRecord[]>;
  listForEntity(entityId: string): Promise<ConditionalHoldRecord[]>;
  markConditionMet(holdId: string, at: string, evidence: ResumeEvidence): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
  resume(holdId: string, at: string, evidence: ResumeEvidence): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
  resumeNow(holdId: string, at: string, evidence: ResumeEvidence): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
  keepHolding(holdId: string, at: string): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
  close(holdId: string, status: "cancelled" | "closed_terminal", at: string): Promise<{ record: ConditionalHoldRecord; idempotent: boolean }>;
}
