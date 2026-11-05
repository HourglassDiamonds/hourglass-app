import { createHash } from "node:crypto";
import { sanitizeAttributionRecord } from "@/lib/attribution";
import type { ContinuumCandidate } from "../candidates/types";
import { assignCandidateId } from "../candidates/identity";
import type {
  AcceptIntakeResult,
  AcknowledgementOutboxItem,
  BookingRequest,
  BookingState,
  CapacityAdmission,
  CapacityConfig,
  ConciergeFunnelRecord,
  ConciergeFunnelStore,
  FollowUpPolicy,
  IntakeInput,
  Qualification,
  SuppressionReason,
} from "./types";
import {
  CONTROLLED_ACCEPTANCE_RULE,
  isControlledAcceptanceFixture,
} from "./controlled-acceptance";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicId(namespace: string, value: string): string {
  return `${namespace}_${sha256(`${namespace}:${value}`).slice(0, 24)}`;
}

function qualificationFor(input: IntakeInput): Qualification {
  if (input.identity.status === "needs_review") return "needs_review";
  if (input.emailVerification !== "verified") return "needs_review";
  return input.inquiry.category === "other" ? "needs_review" : "qualified";
}

function actionSubject(input: IntakeInput, qualification: Qualification): string {
  if (input.identity.status === "needs_review") return `Resolve identity before contacting ${input.inquiry.fullName}`;
  if (input.emailVerification !== "verified") return `Verify contact identity for ${input.inquiry.fullName}`;
  if (qualification === "qualified") return `Personally review ${input.inquiry.fullName}'s ${input.inquiry.projectType} inquiry`;
  return `Review ${input.inquiry.fullName}'s Concierge inquiry`;
}

function buildCandidate(input: IntakeInput, subject: string): ContinuumCandidate {
  const sourceRef = `website-intake:${input.intakeId}`;
  const controlledAcceptance = isControlledAcceptanceFixture(input.inquiry);
  return assignCandidateId({
    candidateId: "",
    sourceSystem: "human-intake",
    sourceRef,
    sourceTimestamp: input.now,
    candidateType: "open_job",
    proposedTarget: { kind: "open_job", projectId: null },
    payload: {
      kind: "open_job",
      jobKind: "required_action",
      subject: controlledAcceptance
        ? "SYNTHETIC ACCEPTANCE — verify Concierge persistence"
        : subject,
      detail: controlledAcceptance
        ? "Controlled Preview fixture only. Do not contact, book, or treat as customer work."
        : "Review the verified intake evidence and decide the personal next step. No Project is created automatically.",
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    },
    confidence: input.identity.status === "needs_review" ? "ambiguous" : "high",
    evidenceBasis: {
      ruleIds: controlledAcceptance
        ? [
            "concierge-intake-v1",
            "founder-review-required",
            CONTROLLED_ACCEPTANCE_RULE,
          ]
        : ["concierge-intake-v1", "founder-review-required"],
      matchedText: null,
    },
    candidateState: "active",
    createdAt: input.now,
    canonical: false,
    automaticApply: false,
    parserVersion: "concierge-funnel-preview-v1",
  });
}

export function buildFunnelRecord(input: IntakeInput): ConciergeFunnelRecord {
  const attribution = sanitizeAttributionRecord(input.inquiry.attribution as Record<string, unknown>);
  const payloadHash = sha256(stableJson({ inquiry: input.inquiry, identity: input.identity, emailVerification: input.emailVerification }));
  const idempotencyKey = sha256(`concierge-funnel:v1:${input.inquiry.submissionId}`);
  const qualification = qualificationFor(input);
  const subject = actionSubject(input, qualification);
  const candidate = buildCandidate(input, subject);
  const controlledAcceptance = isControlledAcceptanceFixture(input.inquiry);
  const leadId = deterministicId("lead", input.intakeId);
  const copyApproved = input.acknowledgementCopy.approvalStatus === "founder_approved";
  return {
    intake: {
      eventId: deterministicId("event", input.intakeId),
      eventType: "concierge.intake.received",
      eventVersion: 1,
      intakeId: input.intakeId,
      submissionId: input.inquiry.submissionId,
      idempotencyKey,
      payloadHash,
      occurredAt: input.now,
      inquiry: { ...input.inquiry, attribution },
      attribution,
      identity: input.identity,
      emailVerification: input.emailVerification,
    },
    lead: {
      leadId,
      intakeId: input.intakeId,
      personId: input.identity.status === "needs_review" ? null : input.identity.personId,
      category: input.inquiry.category,
      qualification,
      attribution,
      createdAt: input.now,
      canonicalProjectId: null,
    },
    nextAction: {
      actionId: deterministicId("action", input.intakeId),
      intakeId: input.intakeId,
      kind: "required_action",
      subject,
      detail: controlledAcceptance
        ? "Synthetic acceptance evidence only. No personal outreach or canonical Project change is permitted."
        : "Founder review is required before any canonical Project change or personal outreach.",
      waitingOnActor: "founder",
      reviewStatus: "pending",
      writesCanonicalProject: false,
      candidate,
    },
    acknowledgement: {
      outboxId: deterministicId("ack", input.intakeId),
      intakeId: input.intakeId,
      idempotencyKey: sha256(`concierge-ack:v1:${input.intakeId}:${input.acknowledgementCopy.copyVersion}`),
      to: input.inquiry.email,
      copy: input.acknowledgementCopy,
      state: copyApproved ? "ready" : "pending_approval",
      attemptCount: 0,
      providerMessageId: null,
      lastAttemptAt: null,
      reconciliationRequired: false,
      createdAt: input.now,
    },
    followUp: {
      consent: input.consent,
      suppressions: controlledAcceptance
        ? [{ reason: "lead_status_changed", occurredAt: input.now }]
        : [],
    },
  };
}

export async function acceptConciergeIntake(store: ConciergeFunnelStore, input: IntakeInput): Promise<AcceptIntakeResult> {
  return store.accept(buildFunnelRecord(input));
}

export type AcknowledgementTransport = {
  readonly mode: "preview-fake";
  send(item: AcknowledgementOutboxItem): Promise<
    | { status: "confirmed"; providerMessageId: string }
    | { status: "unknown" }
    | { status: "failed" }
  >;
};

export async function dispatchAcknowledgement(
  store: ConciergeFunnelStore,
  submissionId: string,
  transport: AcknowledgementTransport,
  now: string,
): Promise<AcknowledgementOutboxItem> {
  const record = await store.getBySubmissionId(submissionId);
  if (!record) throw new Error("acknowledgement-not-found");
  const item = record.acknowledgement;
  if (["sent", "delivery_unknown", "suppressed"].includes(item.state)) return item;
  if (item.copy.approvalStatus !== "founder_approved" || item.state !== "ready") throw new Error("acknowledgement-not-ready");
  const sending = { ...item, state: "sending" as const, attemptCount: item.attemptCount + 1, lastAttemptAt: now };
  await store.updateAcknowledgement(sending);
  const result = await transport.send(sending);
  const updated: AcknowledgementOutboxItem = result.status === "confirmed"
    ? { ...sending, state: "sent", providerMessageId: result.providerMessageId, reconciliationRequired: false }
    : result.status === "unknown"
      ? { ...sending, state: "delivery_unknown", reconciliationRequired: true }
      : { ...sending, state: "failed", reconciliationRequired: true };
  await store.updateAcknowledgement(updated);
  return updated;
}

export function addSuppression(policy: FollowUpPolicy, reason: SuppressionReason, occurredAt: string): FollowUpPolicy {
  if (policy.suppressions.some((item) => item.reason === reason)) return policy;
  return { ...policy, suppressions: [...policy.suppressions, { reason, occurredAt }] };
}

export function maySendFollowUp(policy: FollowUpPolicy): boolean {
  return policy.consent.followUp === "granted" && policy.suppressions.length === 0;
}

function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}

export function offerBooking(request: BookingRequest, offered: { start: string; end: string }, busy: { start: string; end: string }[], now: string): BookingRequest {
  if (busy.some((slot) => overlaps(offered, slot))) throw new Error("booking-conflict");
  return transitionBooking(request, "offered", now, "Founder offered a provider-verified free window.", offered);
}

export function transitionBooking(request: BookingRequest, to: BookingState, now: string, note: string, offeredWindow = request.offeredWindow): BookingRequest {
  const allowed: Record<BookingState, BookingState[]> = {
    requested: ["offered", "declined"],
    offered: ["confirmed", "declined", "rescheduled"],
    confirmed: ["rescheduled", "declined"],
    declined: ["requested"],
    rescheduled: ["confirmed", "declined", "rescheduled"],
  };
  if (!allowed[request.state].includes(to)) throw new Error("invalid-booking-transition");
  return {
    ...request,
    state: to,
    offeredWindow,
    transitions: [...request.transitions, { from: request.state, to, occurredAt: now, note }],
  };
}

export function confirmProviderBooking(request: BookingRequest, providerEventId: string, providerSyncReceipt: string, now: string): BookingRequest {
  if (!providerEventId || !providerSyncReceipt) throw new Error("provider-confirmation-required");
  const next = transitionBooking(request, "confirmed", now, "Google confirmed the event identity.");
  return { ...next, providerEventId, providerSyncReceipt };
}

export function rescheduleProviderBooking(request: BookingRequest, offeredWindow: { start: string; end: string }, providerSyncReceipt: string, busy: { start: string; end: string }[], now: string): BookingRequest {
  if (!request.providerEventId) throw new Error("provider-event-identity-required");
  if (!providerSyncReceipt) throw new Error("provider-confirmation-required");
  if (busy.some((slot) => overlaps(offeredWindow, slot))) throw new Error("booking-conflict");
  const next = transitionBooking(request, "rescheduled", now, "Google confirmed an update to the existing event.", offeredWindow);
  return { ...next, providerEventId: request.providerEventId, providerSyncReceipt };
}

export function admitCapacity(config: CapacityConfig, active: CapacityAdmission[], leadId: string): CapacityAdmission {
  const admitted = active.filter((item) => item.state === "admitted").length;
  if (admitted < config.commissionLimit) return { leadId, capacityId: config.capacityId, state: "admitted", position: null, promisedCapacity: false };
  const position = active.filter((item) => item.state === "waitlisted").length + 1;
  return { leadId, capacityId: config.capacityId, state: "waitlisted", position, promisedCapacity: false };
}
