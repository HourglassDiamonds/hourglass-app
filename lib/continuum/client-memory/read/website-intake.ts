/**
 * Read-only Clients presentation contract for the canonical website intake ledger.
 * Protected PII is restricted to the authenticated internal Concierge surface.
 */

export type ClientWebsiteIntake = {
  intakeId: string;
  jobId: string | null;
  status: "ready" | "needs_review";
  identityStatus: "matched" | "new" | "needs_review";
  personId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  preferredContactMethod: "email" | "phone" | "text" | "any";
  category: string;
  projectType: string;
  shapeInterest: string;
  designDirection: string;
  ringPresence: string;
  timeline: string;
  budgetRange: string;
  inspirationNotes: string;
  attribution: Record<string, unknown>;
  source: string;
  submittedAt: string;
  lifecycle: {
    disposition: "new" | "test_submission" | "solicitation" | "contacted";
    label: string;
    activeJobId: string | null;
    jobState: "open" | "snoozed" | "resolved" | "cancelled" | null;
    projectId: string | null;
    projectTitle: string | null;
    projectStage: string | null;
  };
  correspondenceReview?: {
    candidateId: string;
    status: "pending" | "approved";
    confidence: "low" | "medium" | "high" | "ambiguous";
    sourceTimestamp: string;
  } | null;
};

export type ClientWebsiteIntakeReader = {
  listRecent(options?: { limit?: number }): Promise<ClientWebsiteIntake[]>;
  listActiveRecent(options?: { limit?: number }): Promise<ClientWebsiteIntake[]>;
  listForPerson(personId: string): Promise<ClientWebsiteIntake[]>;
};

export const CLIENT_WEBSITE_INTAKE_RECENT_LIMIT = 25;
