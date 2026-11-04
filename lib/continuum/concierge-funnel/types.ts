import type { AttributionSnapshot } from "@/lib/attribution";
import type { ContinuumCandidate } from "../candidates/types";
import type { WebsiteInquiry, WebsiteIntakeCategory } from "../website-intake/types";

export type IdentityResolution =
  | { status: "new"; personId: null }
  | { status: "matched"; personId: string }
  | { status: "needs_review"; personId: null };

export type EmailVerification = "unverified" | "verified" | "failed";
export type Qualification = "qualified" | "needs_review" | "not_qualified";

export type ConciergeIntakeEvent = {
  eventId: string;
  eventType: "concierge.intake.received";
  eventVersion: 1;
  intakeId: string;
  submissionId: string;
  idempotencyKey: string;
  payloadHash: string;
  occurredAt: string;
  inquiry: WebsiteInquiry;
  attribution: AttributionSnapshot;
  identity: IdentityResolution;
  emailVerification: EmailVerification;
};

export type ConciergeLead = {
  leadId: string;
  intakeId: string;
  personId: string | null;
  category: WebsiteIntakeCategory;
  qualification: Qualification;
  attribution: AttributionSnapshot;
  createdAt: string;
  canonicalProjectId: null;
};

export type FounderNextAction = {
  actionId: string;
  intakeId: string;
  kind: "required_action";
  subject: string;
  detail: string;
  waitingOnActor: "founder";
  reviewStatus: "pending" | "approved" | "discarded" | "deferred";
  writesCanonicalProject: false;
  candidate: ContinuumCandidate;
};

export type AcknowledgementCopy = {
  copyVersion: string;
  approvalStatus: "pending_founder_approval" | "founder_approved";
  subject: string;
  text: string;
};

export type AcknowledgementState =
  | "pending_approval"
  | "ready"
  | "sending"
  | "sent"
  | "delivery_unknown"
  | "failed"
  | "suppressed";

export type AcknowledgementOutboxItem = {
  outboxId: string;
  intakeId: string;
  idempotencyKey: string;
  to: string;
  copy: AcknowledgementCopy;
  state: AcknowledgementState;
  attemptCount: number;
  providerMessageId: string | null;
  lastAttemptAt: string | null;
  reconciliationRequired: boolean;
  createdAt: string;
};

export type CommunicationConsent = {
  serviceAcknowledgement: true;
  followUp: "granted" | "not_granted" | "withdrawn";
  textReply: "granted" | "not_granted";
  capturedAt: string;
  source: "concierge_form";
};

export type SuppressionReason =
  | "reply_received"
  | "booking_confirmed"
  | "opted_out"
  | "lead_status_changed";

export type FollowUpPolicy = {
  consent: CommunicationConsent;
  suppressions: { reason: SuppressionReason; occurredAt: string }[];
};

export type BookingState =
  | "requested"
  | "offered"
  | "confirmed"
  | "declined"
  | "rescheduled";

export type BookingTransition = {
  from: BookingState | null;
  to: BookingState;
  occurredAt: string;
  note: string;
};

export type BookingRequest = {
  bookingId: string;
  leadId: string;
  state: BookingState;
  requestedWindow: { start: string; end: string };
  offeredWindow: { start: string; end: string } | null;
  providerEventId: string | null;
  providerSyncReceipt: string | null;
  transitions: BookingTransition[];
};

export type CapacityConfig = {
  capacityId: string;
  periodStart: string;
  periodEnd: string;
  commissionLimit: number;
};

export type CapacityAdmission = {
  leadId: string;
  capacityId: string;
  state: "admitted" | "waitlisted" | "released";
  position: number | null;
  promisedCapacity: false;
};

export type ConciergeFunnelRecord = {
  intake: ConciergeIntakeEvent;
  lead: ConciergeLead;
  nextAction: FounderNextAction;
  acknowledgement: AcknowledgementOutboxItem;
  followUp: FollowUpPolicy;
};

export type AcceptIntakeResult =
  | { status: "created" | "duplicate"; record: ConciergeFunnelRecord }
  | { status: "idempotency_conflict" };

export interface ConciergeFunnelStore {
  accept(record: ConciergeFunnelRecord): Promise<AcceptIntakeResult>;
  getBySubmissionId(submissionId: string): Promise<ConciergeFunnelRecord | null>;
  updateAcknowledgement(item: AcknowledgementOutboxItem): Promise<void>;
}

export type IntakeInput = {
  intakeId: string;
  inquiry: WebsiteInquiry;
  identity: IdentityResolution;
  emailVerification: EmailVerification;
  acknowledgementCopy: AcknowledgementCopy;
  consent: CommunicationConsent;
  now: string;
};
