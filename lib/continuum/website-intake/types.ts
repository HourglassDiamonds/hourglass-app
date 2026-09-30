import type { AttributionSnapshot } from "@/lib/attribution";

export const WEBSITE_INTAKE_CATEGORIES = [
  "engagement_ring",
  "custom_design",
  "wedding_bands",
  "jewelry_diamond_sourcing",
  "repair_service",
  "existing_client_follow_up",
  "other",
] as const;

export type WebsiteIntakeCategory = (typeof WEBSITE_INTAKE_CATEGORIES)[number];

export type WebsiteInquiry = {
  submissionId: string;
  fullName: string;
  email: string;
  phone: string;
  preferredContactMethod: "email" | "phone" | "text" | "any";
  projectType: string;
  shapeInterest: string;
  designDirection: string;
  ringPresence: string;
  timeline: string;
  budgetRange: string;
  inspirationNotes: string;
  category: WebsiteIntakeCategory;
  attribution: AttributionSnapshot;
  source: string;
  acknowledgementExpected: boolean;
  synthetic: boolean;
};

export type WebsiteIntakeCommand = WebsiteInquiry & {
  intakeId: string;
  personId: string;
  emailIdentityId: string;
  phoneIdentityId: string;
  identityReviewId: string;
  jobId: string;
  jobMutationId: string;
  idempotencyKeyHash: string;
  payloadHash: string;
  emailHash: string;
  phoneHash: string | null;
  submittedAt: string;
};

export type WebsiteIntakeResult =
  | {
      ok: true;
      status: "created" | "already-present";
      intakeId: string;
      identityStatus: "matched" | "new" | "needs_review" | "synthetic";
      personId: string | null;
      jobId: string | null;
      hubspotStatus: "pending" | "succeeded" | "failed" | "skipped";
    }
  | {
      ok: false;
      reason: "unavailable" | "idempotency-conflict" | "invalid-input";
    };

export type HubSpotIntakeOutcome = {
  intakeId: string;
  status: "succeeded" | "failed" | "skipped";
  contactId?: string | null;
  dealId?: string | null;
  errorCode?: string | null;
};

export interface WebsiteIntakeStore {
  ingest(command: WebsiteIntakeCommand): Promise<WebsiteIntakeResult>;
  recordHubSpotOutcome(outcome: HubSpotIntakeOutcome): Promise<void>;
}
