import type { WebsiteInquiry } from "../website-intake/types";

export const CONTROLLED_ACCEPTANCE_SUBMISSION_ID =
  "11111111-1111-4111-8111-111111111111" as const;
export const CONTROLLED_ACCEPTANCE_EMAIL =
  "concierge-acceptance@example.test" as const;
export const CONTROLLED_ACCEPTANCE_RULE =
  "concierge-controlled-synthetic-acceptance" as const;
export const CONTROLLED_ACCEPTANCE_PAYLOAD = {
  acceptancePurpose: "controlled-preview-acceptance",
  submissionId: CONTROLLED_ACCEPTANCE_SUBMISSION_ID,
  fullName: "Preview Fixture",
  email: CONTROLLED_ACCEPTANCE_EMAIL,
  phone: "",
  preferredContactMethod: "Email",
  projectType: "Engagement Ring",
  shapeInterest: "Round",
  designDirection: "Classic Timeless",
  ringPresence: "Understated",
  timeline: "3–4 months",
  budgetRange: "10–20k",
  inspirationNotes: "Controlled Preview acceptance fixture.",
  attribution: {
    utm_source: "preview_acceptance",
    landing_path: "/concierge",
  },
  requestedWindow: {
    start: "2026-11-12T18:00:00.000Z",
    end: "2026-11-12T19:00:00.000Z",
  },
} as const;

export function stampControlledAcceptanceInquiry(
  inquiry: WebsiteInquiry,
): WebsiteInquiry | null {
  if (
    inquiry.submissionId !== CONTROLLED_ACCEPTANCE_SUBMISSION_ID ||
    inquiry.email !== CONTROLLED_ACCEPTANCE_EMAIL
  ) {
    return null;
  }
  return {
    ...inquiry,
    fullName: `SYNTHETIC ACCEPTANCE — ${inquiry.fullName}`,
    inspirationNotes:
      `[SYNTHETIC ACCEPTANCE FIXTURE — NO CUSTOMER CONTACT]\n${inquiry.inspirationNotes}`,
    attribution: {
      ...inquiry.attribution,
      utm_campaign: "continuum_concierge_p0_9_synthetic_acceptance",
      originating_tool: "continuum_concierge_acceptance_control",
      originating_content: "synthetic_fixture_p0_9",
      last_cta_location: "founder_acceptance_control",
    },
    // Compatibility classification: the installed website-intake RPC uses
    // synthetic=true to suppress Person/Job persistence entirely. This
    // controlled fixture instead carries durable acceptance markers across
    // the intake, Candidate, Job and Today presentation while retaining the
    // exact persistence path being accepted.
    synthetic: false,
  };
}
export function isControlledAcceptanceFixture(
  inquiry: Pick<WebsiteInquiry, "submissionId" | "email" | "fullName" | "attribution">,
): boolean {
  return (
    inquiry.submissionId === CONTROLLED_ACCEPTANCE_SUBMISSION_ID &&
    inquiry.email === CONTROLLED_ACCEPTANCE_EMAIL &&
    inquiry.fullName.startsWith("SYNTHETIC ACCEPTANCE — ") &&
    inquiry.attribution.originating_tool ===
      "continuum_concierge_acceptance_control"
  );
}
