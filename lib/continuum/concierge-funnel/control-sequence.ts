import { CONTROLLED_ACCEPTANCE_PAYLOAD } from "./controlled-acceptance";

export type AcceptanceResponse = {
  ok: boolean;
  funnelStatus?: "created" | "duplicate";
  intakeId?: string;
  personId?: string | null;
  jobId?: string | null;
  candidateId?: string;
  founderAction?: {
    id: string;
    sourceLabel: string;
    headline: string;
    reviewStatus: string;
  };
  acknowledgement?: {
    outboxId: string;
    state: string;
    attemptCount: number;
    providerMessageId: string | null;
    reconciliationRequired: boolean;
  };
  booking?: {
    bookingId: string;
    state: string;
    offeredWindow: unknown;
    providerEventId: string | null;
  };
  deliveryMode?: string;
  error?: string;
  stage?: string;
};

export type AcceptanceVerification = {
  ok: boolean;
  identifiers?: {
    intakeId: string;
    personId: string | null;
    jobId: string | null;
    candidateId: string;
    outboxId: string;
  };
  counts?: Record<"intakes" | "people" | "jobs" | "candidates" | "outbox", number>;
  attribution?: unknown;
  source?: string;
  sourceLabel?: string;
  identityStatus?: string;
  founderReview?: {
    status: string;
    title: string;
    headline: string;
    persistsAcrossReload: boolean;
    writesCanonicalProject: boolean;
  };
  syntheticClassification?: {
    acceptanceFixture: boolean;
    websiteIntakeSynthetic: boolean;
    rule: string;
    compatibilityNote: string;
  };
  acknowledgement?: {
    state: string;
    attemptCount: number;
    providerMessageId: string | null;
    reconciliationRequired: boolean;
  };
  booking?: {
    bookingId: string;
    state: string;
    offeredWindow: unknown;
    providerEventId: string | null;
  };
  providerSafety?: {
    hubspotContactId: string | null;
    hubspotDealId: string | null;
    hubspotStatus: string;
    outboundDeliveryAttempted: boolean;
  };
  error?: string;
};

export type AcceptanceControlResult = {
  first: AcceptanceResponse;
  replay: AcceptanceResponse;
  verification: AcceptanceVerification;
  complete: boolean;
  checks: { label: string; passed: boolean }[];
};

type Requester = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function json<T>(response: Awaited<ReturnType<Requester>>): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    const error = body as { error?: string; stage?: string };
    throw new Error(
      [error.stage, error.error, `HTTP ${response.status}`]
        .filter(Boolean)
        .join(": "),
    );
  }
  return body;
}
export async function runControlledAcceptanceSequence(
  request: Requester,
): Promise<AcceptanceControlResult> {
  const post = () =>
    request("/executive-dashboard/concierge/preview-acceptance", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CONTROLLED_ACCEPTANCE_PAYLOAD),
    }).then((response) => json<AcceptanceResponse>(response));

  const first = await post();
  const replay = await post();
  const verification = await request(
    "/executive-dashboard/concierge/preview-acceptance-control/verify",
    {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      cache: "no-store",
    },
  ).then((response) => json<AcceptanceVerification>(response));

  const sameIds =
    first.intakeId === replay.intakeId &&
    first.candidateId === replay.candidateId &&
    first.acknowledgement?.outboxId === replay.acknowledgement?.outboxId;
  const counts = verification.counts;
  const identifiers = verification.identifiers;
  const checks = [
    { label: "First submission created the fixture", passed: first.funnelStatus === "created" },
    { label: "Identical replay returned duplicate", passed: replay.funnelStatus === "duplicate" },
    { label: "Replay returned the original identities", passed: sameIds },
    {
      label: "One Person, Job, Candidate and outbox row persisted",
      passed:
        Boolean(counts) &&
        Object.values(counts ?? {}).every((count) => count === 1),
    },
    {
      label: "Server reload returned the submitted identifiers",
      passed:
        identifiers?.intakeId === first.intakeId &&
        identifiers?.candidateId === first.candidateId &&
        identifiers?.outboxId === first.acknowledgement?.outboxId,
    },
    { label: "Source is Website Concierge", passed: verification.sourceLabel === "Website Concierge" },
    {
      label: "Fixture is durably marked synthetic acceptance",
      passed: verification.syntheticClassification?.acceptanceFixture === true,
    },
    {
      label: "Candidate remains founder-review pending and noncanonical",
      passed:
        verification.founderReview?.status === "pending" &&
        verification.founderReview.writesCanonicalProject === false,
    },
    {
      label: "Acknowledgment is ready with zero delivery attempts",
      passed:
        verification.acknowledgement?.state === "ready" &&
        verification.acknowledgement.attemptCount === 0 &&
        verification.acknowledgement.providerMessageId == null,
    },
    {
      label: "Booking remains requested without offered availability",
      passed:
        verification.booking?.state === "requested" &&
        verification.booking.offeredWindow == null &&
        verification.booking.providerEventId == null,
    },
    {
      label: "No HubSpot or outbound delivery identity exists",
      passed:
        verification.providerSafety?.hubspotContactId == null &&
        verification.providerSafety?.hubspotDealId == null &&
        verification.providerSafety?.outboundDeliveryAttempted === false,
    },
  ];

  return {
    first,
    replay,
    verification,
    checks,
    complete: checks.every((check) => check.passed),
  };
}
