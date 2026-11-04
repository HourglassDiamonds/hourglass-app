import { createHash } from "node:crypto";
import type { CosFounderAttentionItem } from "../chief-of-staff/operating-loop/types";
import { ingestWebsiteInquiry } from "../website-intake/ingest";
import type {
  HubSpotIntakeOutcome,
  WebsiteInquiry,
  WebsiteIntakeCommand,
  WebsiteIntakeResult,
  WebsiteIntakeStore,
} from "../website-intake/types";
import {
  acceptConciergeIntake,
  dispatchAcknowledgement,
  type AcknowledgementTransport,
} from "./kernel";
import type {
  AcknowledgementCopy,
  BookingRequest,
  CommunicationConsent,
  ConciergeFunnelRecord,
  ConciergeFunnelStore,
  EmailVerification,
  IdentityResolution,
} from "./types";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Deterministic substitute for the existing website-intake RPC. It models its
 * replay and exact-identity behavior but never connects to Supabase or HubSpot.
 */
export class PreviewWebsiteIntakeStore implements WebsiteIntakeStore {
  private readonly intakes = new Map<
    string,
    { command: WebsiteIntakeCommand; result: WebsiteIntakeResult & { ok: true } }
  >();
  private readonly people = new Set<string>();
  readonly hubSpotOutcomes: HubSpotIntakeOutcome[] = [];

  constructor(
    private readonly identities: ReadonlyMap<string, readonly string[]> = new Map(),
    private readonly available = true,
  ) {
    for (const personIds of identities.values()) {
      for (const personId of personIds) this.people.add(personId);
    }
  }

  async ingest(command: WebsiteIntakeCommand): Promise<WebsiteIntakeResult> {
    if (!this.available) return { ok: false, reason: "unavailable" };
    const existing = this.intakes.get(command.idempotencyKeyHash);
    if (existing) {
      if (existing.command.payloadHash !== command.payloadHash) {
        return { ok: false, reason: "idempotency-conflict" };
      }
      return { ...existing.result, status: "already-present" };
    }

    const matches = new Set([
      ...(this.identities.get(command.emailHash) ?? []),
      ...(command.phoneHash ? (this.identities.get(command.phoneHash) ?? []) : []),
    ]);
    const identityStatus =
      matches.size > 1 ? "needs_review" : matches.size === 1 ? "matched" : "new";
    const personId =
      identityStatus === "needs_review"
        ? null
        : identityStatus === "matched"
          ? [...matches][0]!
          : command.personId;
    if (identityStatus === "new") this.people.add(command.personId);
    const result: WebsiteIntakeResult & { ok: true } = {
      ok: true,
      status: "created",
      intakeId: command.intakeId,
      identityStatus,
      personId,
      jobId: command.jobId,
      hubspotStatus: "skipped",
    };
    this.intakes.set(command.idempotencyKeyHash, {
      command: structuredClone(command),
      result,
    });
    return structuredClone(result);
  }

  async recordHubSpotOutcome(outcome: HubSpotIntakeOutcome): Promise<void> {
    this.hubSpotOutcomes.push(structuredClone(outcome));
  }

  get intakeCount(): number {
    return this.intakes.size;
  }

  get personCount(): number {
    return this.people.size;
  }
}

export type SterlingTodayNextAction = CosFounderAttentionItem & {
  integrationSource: "concierge-funnel-preview";
  writesCanonicalProject: false;
};

export function prepareSterlingTodayNextAction(
  record: ConciergeFunnelRecord,
): SterlingTodayNextAction {
  return {
    id: `attention:website-intake:${record.intake.intakeId}`,
    lane: "decision",
    title: "New Concierge inquiry",
    headline: record.nextAction.subject,
    detail: record.nextAction.detail,
    projectId: null,
    projectTitle: null,
    sourceLabel: "Website Concierge",
    sourceHref: null,
    candidateIds: [record.nextAction.candidate.candidateId],
    recap: null,
    proposedAction: null,
    specConflict: null,
    integrationSource: "concierge-funnel-preview",
    writesCanonicalProject: false,
  };
}

export function createBookingRequest(
  record: ConciergeFunnelRecord,
  requestedWindow: { start: string; end: string },
  now: string,
): BookingRequest {
  return {
    bookingId: `booking_${sha256(record.intake.intakeId).slice(0, 24)}`,
    leadId: record.lead.leadId,
    state: "requested",
    requestedWindow,
    offeredWindow: null,
    providerEventId: null,
    providerSyncReceipt: null,
    transitions: [
      {
        from: null,
        to: "requested",
        occurredAt: now,
        note: "Client requested scheduling; availability has not been offered.",
      },
    ],
  };
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

export type PreviewAcceptanceResult =
  | {
      ok: true;
      intake: WebsiteIntakeResult & { ok: true };
      funnelStatus: "created" | "duplicate";
      record: ConciergeFunnelRecord;
      todayAction: SterlingTodayNextAction;
      acknowledgement: ConciergeFunnelRecord["acknowledgement"];
      booking: BookingRequest;
    }
  | {
      ok: false;
      stage: "website-intake" | "concierge-funnel";
      reason: "unavailable" | "idempotency-conflict" | "invalid-input";
    };

export async function runPreviewConciergeAcceptance(input: {
  inquiry: WebsiteInquiry;
  websiteStore: WebsiteIntakeStore;
  funnelStore: ConciergeFunnelStore;
  emailVerification: EmailVerification;
  acknowledgementCopy: AcknowledgementCopy;
  consent: CommunicationConsent;
  acknowledgementTransport: AcknowledgementTransport;
  requestedWindow: { start: string; end: string };
  now: string;
}): Promise<PreviewAcceptanceResult> {
  const intake = await ingestWebsiteInquiry(input.websiteStore, input.inquiry);
  if (!intake.ok) {
    return { ok: false, stage: "website-intake", reason: intake.reason };
  }
  if (intake.identityStatus === "synthetic") {
    return { ok: false, stage: "website-intake", reason: "invalid-input" };
  }

  const funnel = await acceptConciergeIntake(input.funnelStore, {
    intakeId: intake.intakeId,
    inquiry: input.inquiry,
    identity: identityFromIntake(intake),
    emailVerification: input.emailVerification,
    acknowledgementCopy: input.acknowledgementCopy,
    consent: input.consent,
    now: input.now,
  });
  if (funnel.status === "idempotency_conflict") {
    return {
      ok: false,
      stage: "concierge-funnel",
      reason: "idempotency-conflict",
    };
  }

  const acknowledgement = await dispatchAcknowledgement(
    input.funnelStore,
    input.inquiry.submissionId,
    input.acknowledgementTransport,
    input.now,
  );
  return {
    ok: true,
    intake,
    funnelStatus: funnel.status,
    record: funnel.record,
    todayAction: prepareSterlingTodayNextAction(funnel.record),
    acknowledgement,
    booking: createBookingRequest(funnel.record, input.requestedWindow, input.now),
  };
}
