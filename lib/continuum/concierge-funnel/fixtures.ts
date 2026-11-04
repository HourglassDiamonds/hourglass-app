import type { WebsiteInquiry } from "../website-intake/types";
import type { AcknowledgementCopy, CommunicationConsent, IntakeInput } from "./types";

export const FIXTURE_NOW = "2026-11-04T15:00:00.000Z";

export const APPROVED_PREVIEW_COPY: AcknowledgementCopy = {
  copyVersion: "quiet-luxury-v1",
  approvalStatus: "founder_approved",
  subject: "Your Hourglass Concierge inquiry",
  text: "Thank you for reaching out to Hourglass Diamonds. Justin will personally review your note and follow up thoughtfully. There is nothing more you need to do for now.",
};

export const PENDING_COPY: AcknowledgementCopy = {
  ...APPROVED_PREVIEW_COPY,
  approvalStatus: "pending_founder_approval",
};

export const SERVICE_ONLY_CONSENT: CommunicationConsent = {
  serviceAcknowledgement: true,
  followUp: "not_granted",
  textReply: "not_granted",
  capturedAt: FIXTURE_NOW,
  source: "concierge_form",
};

export function fixtureInquiry(overrides: Partial<WebsiteInquiry> = {}): WebsiteInquiry {
  return {
    submissionId: "11111111-1111-4111-8111-111111111111",
    fullName: "Avery Client",
    email: "avery@example.test",
    phone: "",
    preferredContactMethod: "email",
    projectType: "Engagement Ring",
    shapeInterest: "Round",
    designDirection: "Classic Timeless",
    ringPresence: "Understated",
    timeline: "3–4 months",
    budgetRange: "10–20k",
    inspirationNotes: "A restrained, timeless design.",
    category: "engagement_ring",
    attribution: { utm_source: "editorial", utm_campaign: "heirloom", landing_path: "/diamond-guide" },
    source: "hourglassdiamonds.com/concierge",
    acknowledgementExpected: true,
    synthetic: false,
    ...overrides,
  };
}

export function fixtureInput(overrides: Partial<IntakeInput> = {}): IntakeInput {
  return {
    intakeId: "intake-fixture-001",
    inquiry: fixtureInquiry(),
    identity: { status: "new", personId: "33333333-3333-4333-8333-333333333333" },
    emailVerification: "verified",
    acknowledgementCopy: APPROVED_PREVIEW_COPY,
    consent: SERVICE_ONLY_CONSENT,
    now: FIXTURE_NOW,
    ...overrides,
  };
}
