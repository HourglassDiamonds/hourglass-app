import { sanitizeAttributionRecord } from "@/lib/attribution";
import {
  classifyWebsiteInquiry,
  validateWebsiteInquiryFormData,
} from "../website-intake/validation";
import type { WebsiteInquiry } from "../website-intake/types";
import {
  CONCIERGE_WEBSITE_SOURCE,
  type PreparedConciergeAcceptance,
  type ConciergeAcceptanceFailure,
} from "./application";
import { APPROVED_CONCIERGE_ACKNOWLEDGEMENT_COPY } from "./copy";
import type { CommunicationConsent } from "./types";
import { stampControlledAcceptanceInquiry } from "./controlled-acceptance";

const MAX_JSON_BYTES = 32_000;
const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
} as const;

type PrepareResult = PreparedConciergeAcceptance | ConciergeAcceptanceFailure;

export type PreviewAcceptanceEndpointDependencies = {
  enabled(): boolean;
  authorize(request: Request): Promise<boolean>;
  prepare(input: {
    inquiry: WebsiteInquiry;
    acknowledgementCopy: typeof APPROVED_CONCIERGE_ACKNOWLEDGEMENT_COPY;
    consent: CommunicationConsent;
    requestedWindow: { start: string; end: string };
    now: string;
  }): Promise<PrepareResult>;
  now(): string;
};

function json(body: object, status: number) {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requestedWindow(value: unknown): { start: string; end: string } | null {
  const row = record(value);
  if (!row || typeof row.start !== "string" || typeof row.end !== "string") {
    return null;
  }
  const start = Date.parse(row.start);
  const end = Date.parse(row.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  return { start: row.start, end: row.end };
}

function parseInquiry(body: Record<string, unknown>): WebsiteInquiry | null {
  if (body.acceptancePurpose !== "controlled-preview-acceptance") return null;
  const form = new FormData();
  for (const key of [
    "submissionId",
    "fullName",
    "email",
    "phone",
    "preferredContactMethod",
    "projectType",
    "shapeInterest",
    "designDirection",
    "ringPresence",
    "timeline",
    "budgetRange",
    "inspirationNotes",
  ]) {
    const value = body[key];
    if (typeof value !== "string") return null;
    form.set(key, value);
  }
  const validated = validateWebsiteInquiryFormData(form);
  if (!validated.ok || !validated.value.email.endsWith("@example.test")) return null;
  const attribution = record(body.attribution);
  if (!attribution) return null;
  return stampControlledAcceptanceInquiry({
    ...validated.value,
    category: classifyWebsiteInquiry(validated.value.projectType),
    attribution: sanitizeAttributionRecord(attribution),
    source: CONCIERGE_WEBSITE_SOURCE,
    acknowledgementExpected: true,
    synthetic: false,
  });
}

/** Authenticated, dual-flagged, Preview-only controlled fixture endpoint. */
export function createPreviewConciergeAcceptanceHandler(
  deps: PreviewAcceptanceEndpointDependencies,
) {
  return async function POST(request: Request): Promise<Response> {
    if (!deps.enabled()) return json({ ok: false, error: "not-found" }, 404);
    if (!sameOrigin(request)) return json({ ok: false, error: "invalid-origin" }, 403);
    if (!(await deps.authorize(request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ ok: false, error: "invalid-request" }, 415);
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
      return json({ ok: false, error: "invalid-request" }, 413);
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = record(await request.json());
    } catch {
      // Invalid JSON is a bounded client error, not an availability failure.
    }
    const inquiry = body ? parseInquiry(body) : null;
    const window = body ? requestedWindow(body.requestedWindow) : null;
    if (!inquiry || !window) {
      return json({ ok: false, error: "invalid-request" }, 400);
    }

    const now = deps.now();
    const result = await deps.prepare({
      inquiry,
      acknowledgementCopy: APPROVED_CONCIERGE_ACKNOWLEDGEMENT_COPY,
      consent: {
        serviceAcknowledgement: true,
        followUp: "not_granted",
        textReply: "not_granted",
        capturedAt: now,
        source: "concierge_form",
      },
      requestedWindow: window,
      now,
    });
    if (!result.ok) {
      const status = result.reason === "idempotency-conflict" ? 409 : 503;
      return json({ ok: false, stage: result.stage, error: result.reason }, status);
    }

    return json(
      {
        ok: true,
        intakeStatus: result.intake.status,
        funnelStatus: result.funnelStatus,
        intakeId: result.record.intake.intakeId,
        personId: result.intake.personId,
        jobId: result.intake.jobId,
        candidateId: result.record.nextAction.candidate.candidateId,
        identityStatus: result.record.intake.identity.status,
        qualification: result.record.lead.qualification,
        founderAction: {
          id: result.todayAction.id,
          sourceLabel: result.todayAction.sourceLabel,
          headline: result.todayAction.headline,
          reviewStatus: result.record.nextAction.reviewStatus,
        },
        acknowledgement: {
          outboxId: result.acknowledgement.outboxId,
          state: result.acknowledgement.state,
          attemptCount: result.acknowledgement.attemptCount,
          reconciliationRequired: result.acknowledgement.reconciliationRequired,
          providerMessageId: result.acknowledgement.providerMessageId,
        },
        booking: result.booking,
        deliveryMode: result.deliveryMode,
      },
      200,
    );
  };
}
