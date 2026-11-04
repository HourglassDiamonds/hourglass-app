import { ingestWebsiteInquiry } from "../website-intake/ingest";
import type {
  WebsiteInquiry,
  WebsiteIntakeResult,
  WebsiteIntakeStore,
} from "../website-intake/types";
import { acceptConciergeIntake } from "./kernel";
import {
  createBookingRequest,
  prepareSterlingTodayNextAction,
  type SterlingTodayNextAction,
} from "./preview-acceptance";
import type {
  AcknowledgementCopy,
  BookingRequest,
  CommunicationConsent,
  ConciergeFunnelRecord,
  ConciergeFunnelStore,
  EmailVerification,
  IdentityResolution,
} from "./types";

export const CONCIERGE_WEBSITE_SOURCE =
  "hourglassdiamonds.com/concierge" as const;

export type EmailVerificationEvidence =
  | { status: "unverified" | "failed" }
  | {
      status: "verified";
      source: "authoritative_existing_identity" | "provider_receipt";
      reference: string;
    };

function verifiedStatus(
  evidence: EmailVerificationEvidence | undefined,
): EmailVerification | null {
  if (!evidence) return "unverified";
  if (evidence.status !== "verified") return evidence.status;
  if (!evidence.reference.trim()) return null;
  return "verified";
}

function identityFromIntake(
  result: WebsiteIntakeResult & { ok: true },
): IdentityResolution {
  if (result.identityStatus === "matched" && result.personId) {
    return { status: "matched", personId: result.personId };
  }
  if (result.identityStatus === "new" && result.personId) {
    return { status: "new", personId: result.personId };
  }
  return { status: "needs_review", personId: null };
}

export type PreparedConciergeAcceptance = {
  ok: true;
  intake: WebsiteIntakeResult & { ok: true };
  funnelStatus: "created" | "duplicate";
  record: ConciergeFunnelRecord;
  todayAction: SterlingTodayNextAction;
  acknowledgement: ConciergeFunnelRecord["acknowledgement"];
  booking: BookingRequest;
  deliveryMode: "preview-fake-not-dispatched";
};

export type ConciergeAcceptanceFailure = {
  ok: false;
  stage: "validation" | "website-intake" | "concierge-funnel" | "reload";
  reason:
    | "invalid-input"
    | "unavailable"
    | "idempotency-conflict"
    | "acknowledgement-not-expected";
};

/**
 * Preparation-only application integration. It persists the intake proposal and
 * approved outbox item, then reloads the durable record. It deliberately has no
 * transport dependency, so this path cannot send a customer message.
 */
export async function preparePersistentConciergeAcceptance(input: {
  inquiry: WebsiteInquiry;
  websiteStore: WebsiteIntakeStore;
  funnelStore: ConciergeFunnelStore;
  emailVerificationEvidence?: EmailVerificationEvidence;
  acknowledgementCopy: AcknowledgementCopy;
  consent: CommunicationConsent;
  requestedWindow: { start: string; end: string };
  now: string;
}): Promise<PreparedConciergeAcceptance | ConciergeAcceptanceFailure> {
  const verification = verifiedStatus(input.emailVerificationEvidence);
  if (
    !verification ||
    input.inquiry.source !== CONCIERGE_WEBSITE_SOURCE ||
    input.inquiry.synthetic ||
    !input.inquiry.acknowledgementExpected ||
    input.acknowledgementCopy.approvalStatus !== "founder_approved"
  ) {
    return { ok: false, stage: "validation", reason: "invalid-input" };
  }

  const start = Date.parse(input.requestedWindow.start);
  const end = Date.parse(input.requestedWindow.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return { ok: false, stage: "validation", reason: "invalid-input" };
  }

  const intake = await ingestWebsiteInquiry(input.websiteStore, input.inquiry);
  if (!intake.ok) {
    return { ok: false, stage: "website-intake", reason: intake.reason };
  }
  if (intake.identityStatus === "synthetic") {
    return { ok: false, stage: "website-intake", reason: "invalid-input" };
  }

  try {
    const accepted = await acceptConciergeIntake(input.funnelStore, {
      intakeId: intake.intakeId,
      inquiry: input.inquiry,
      identity: identityFromIntake(intake),
      emailVerification: verification,
      acknowledgementCopy: input.acknowledgementCopy,
      consent: input.consent,
      now: input.now,
    });
    if (accepted.status === "idempotency_conflict") {
      return {
        ok: false,
        stage: "concierge-funnel",
        reason: "idempotency-conflict",
      };
    }

    const reloaded = await input.funnelStore.getBySubmissionId(
      input.inquiry.submissionId,
    );
    if (!reloaded) {
      return { ok: false, stage: "reload", reason: "unavailable" };
    }
    return {
      ok: true,
      intake,
      funnelStatus: accepted.status,
      record: reloaded,
      todayAction: prepareSterlingTodayNextAction(reloaded),
      acknowledgement: reloaded.acknowledgement,
      booking: createBookingRequest(
        reloaded,
        input.requestedWindow,
        input.now,
      ),
      deliveryMode: "preview-fake-not-dispatched",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("website-acknowledgement-not-pending")
    ) {
      return {
        ok: false,
        stage: "concierge-funnel",
        reason: "acknowledgement-not-expected",
      };
    }
    return { ok: false, stage: "concierge-funnel", reason: "unavailable" };
  }
}
