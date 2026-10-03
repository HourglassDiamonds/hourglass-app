import type { WebsiteInquiry, WebsiteIntakeResult } from "./types";

const OPAQUE_SUBMISSION_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

export type WebsiteIntakeIngest = (
  inquiry: WebsiteInquiry,
) => Promise<WebsiteIntakeResult>;

export type SyntheticWebsiteIntakeAcceptanceResult =
  | {
      ok: true;
      intakeId: string;
      initialStatus: "created" | "already-present";
      replayStatus: "already-present";
      isolated: true;
    }
  | {
      ok: false;
      reason:
        | "invalid-submission-id"
        | "ingest-failed"
        | "isolation-failed"
        | "idempotency-failed";
    };

export function isSyntheticAcceptanceSubmissionId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_SUBMISSION_ID_RE.test(value);
}

function syntheticInquiry(submissionId: string): WebsiteInquiry {
  return {
    submissionId,
    fullName: "Continuum Synthetic Acceptance",
    email: `continuum-acceptance+${submissionId}@healthcheck.invalid`,
    phone: "",
    preferredContactMethod: "email",
    projectType: "Still Exploring",
    shapeInterest: "Not Sure Yet",
    designDirection: "Still Discovering",
    ringPresence: "Still Exploring",
    timeline: "Flexible",
    budgetRange: "Prefer to Discuss",
    inspirationNotes:
      "CONTINUUM BOUNDED TEST — WEBSITE INTAKE — DO NOT ACTION",
    category: "other",
    attribution: {},
    source: "hourglassdiamonds.com/concierge",
    acknowledgementExpected: false,
    synthetic: true,
  };
}

function isIsolated(
  result: WebsiteIntakeResult,
): result is Extract<WebsiteIntakeResult, { ok: true }> {
  return result.ok
    && result.identityStatus === "synthetic"
    && result.personId === null
    && result.jobId === null
    && result.hubspotStatus === "skipped";
}

/**
 * Runs one synthetic intake plus an exact replay through the canonical intake
 * writer. The caller owns authentication; this helper never calls CRM, SLA,
 * messaging, or public-concierge code.
 */
export async function runSyntheticWebsiteIntakeAcceptance(options: {
  submissionId: string;
  ingest: WebsiteIntakeIngest;
}): Promise<SyntheticWebsiteIntakeAcceptanceResult> {
  if (!isSyntheticAcceptanceSubmissionId(options.submissionId)) {
    return { ok: false, reason: "invalid-submission-id" };
  }

  const inquiry = syntheticInquiry(options.submissionId);
  const initial = await options.ingest(inquiry);
  if (!initial.ok) return { ok: false, reason: "ingest-failed" };
  if (!isIsolated(initial)) return { ok: false, reason: "isolation-failed" };

  const replay = await options.ingest(inquiry);
  if (!replay.ok) return { ok: false, reason: "ingest-failed" };
  if (!isIsolated(replay)) return { ok: false, reason: "isolation-failed" };
  if (replay.status !== "already-present" || replay.intakeId !== initial.intakeId) {
    return { ok: false, reason: "idempotency-failed" };
  }

  return {
    ok: true,
    intakeId: initial.intakeId,
    initialStatus: initial.status,
    replayStatus: replay.status,
    isolated: true,
  };
}
