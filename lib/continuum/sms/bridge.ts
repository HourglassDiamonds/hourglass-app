/**
 * SMS source-event bridge.
 * MessageAdapterInput → normalized SMS → identity and line routing →
 * SourceCommunicationEvent → sourceEventsForWorkLoop →
 * workLoopEventsFromSource → reduceWorkLoop.
 * Historical and withheld messages stay evidence. They do not enter Today.
 */

import { currentCadTokensFromIdentityHay } from "@/lib/continuum/candidates/work-loop-identity";
import { reduceWorkLoop } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type { ReducedWorkLoopState } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type { ThreadWaitingKind } from "@/lib/continuum/chief-of-staff/operating-loop/thread-truth";
import {
  authorOwnedText,
  quotedText,
} from "@/lib/continuum/gmail/candidates/spec-provenance";
import { classifySourceCommunication } from "@/lib/continuum/source-events/classify";
import { sourceEventsForWorkLoop } from "@/lib/continuum/source-events/gmail";
import {
  isCurrentWorkSourceClass,
  isSmsObservationProvenance,
} from "@/lib/continuum/source-events/types";
import type {
  SmsObservationProvenance,
  SmsTodayAdmission,
  SourceCommunicationActor,
  SourceCommunicationEvent,
  SourceCommunicationEventClass,
} from "@/lib/continuum/source-events/types";
import {
  existingPersonById,
  isInternalPhoneHash,
  isVendorRole,
  isWorkContactRole,
  resolveSmsPersonIdentity,
} from "./identity";
import type { SmsIdentityDecision } from "./identity";
import { normalizeSmsMessage } from "./normalize";
import {
  SMS_BRIDGE_PRODUCER,
  SMS_MUTATION_BOUNDARY,
  type MessageAdapterInput,
  type SmsIdentityPerson,
  type SmsIdentityWorld,
  type SmsParseSurface,
} from "./types";

const ORDER_ID = /\bSP\d{4,}\b/gi;
const RN_ID = /\bRN\d{4,}\b/gi;

export type SmsBridgeObservation = {
  event: SourceCommunicationEvent;
  identity: SmsIdentityDecision;
  admission: SmsTodayAdmission;
  createsPerson: false;
  createsProject: false;
  mutationBoundary: typeof SMS_MUTATION_BOUNDARY;
};

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = value.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function matches(text: string, pattern: RegExp): string[] {
  return unique([...(text.match(pattern) ?? [])].map((row) => row.toUpperCase()));
}

function counterparty(surface: SmsParseSurface): SmsParseSurface["message"]["sender"] {
  const { message } = surface;
  if (message.direction !== "outbound") return message.sender;
  const other = message.participants.find(
    (row) => row.phoneHash && row.phoneHash !== message.sender.phoneHash,
  );
  return other ?? message.sender;
}

function hashesOf(surface: SmsParseSurface): string[] {
  return surface.message.participants
    .map((row) => row.phoneHash)
    .filter((value): value is string => Boolean(value));
}

function resolvedIdentity(
  surface: SmsParseSurface,
  world: SmsIdentityWorld,
): SmsIdentityDecision {
  const routed = existingPersonById(world, surface.message.routedPersonId);
  if ((surface.message.manuallyRouted || surface.message.founderSelected) && routed) {
    return {
      status: isVendorRole(routed.role) ? "vendor-context" : "matched",
      personId: routed.personId,
      person: routed,
      phoneHash: routed.phoneHash,
      personIds: [routed.personId],
      ruleId: "routed_existing_person",
      mintPerson: false,
    };
  }
  return resolveSmsPersonIdentity(counterparty(surface), world);
}

function messageIsInternal(surface: SmsParseSurface, world: SmsIdentityWorld): boolean {
  return hashesOf(surface).some((hash) => isInternalPhoneHash(hash, world));
}

function actorFor(input: {
  surface: SmsParseSurface;
  identity: SmsIdentityDecision;
  world: SmsIdentityWorld;
  internal: boolean;
}): SourceCommunicationActor {
  if (input.internal) return "unknown";
  const senderHash = input.surface.message.sender.phoneHash;
  if (senderHash && input.world.founderPhoneHashes?.includes(senderHash)) return "founder";
  if (input.surface.message.direction === "outbound") return "founder";
  const person = input.identity.person;
  if (!person || input.identity.status === "review") return "unknown";
  if (isVendorRole(person.role)) return "vendor_shop";
  if (person.role === "client") return "client";
  return "unknown";
}

function workContact(person: SmsIdentityPerson | null): boolean {
  return person != null && isWorkContactRole(person.role);
}

export function smsTodayAdmission(input: {
  surface: SmsParseSurface;
  identity: SmsIdentityDecision;
  internal: boolean;
}): SmsTodayAdmission {
  if (input.internal || input.identity.ruleId === "internal_number") {
    return "internal_withheld";
  }
  if (input.surface.message.ingestClass !== "live") return "historical_evidence_only";

  const { lineClass, founderSelected, manuallyRouted } = input.surface.message;
  const explicit = founderSelected || manuallyRouted;
  const person = input.identity.person;
  const knownWorkContact =
    input.identity.status !== "review" && workContact(person);

  if (lineClass === "unknown" && !explicit) return "unknown_line_withheld";
  if (lineClass === "personal" && !knownWorkContact && !explicit) {
    return "personal_unknown_withheld";
  }
  if (input.identity.status === "review") return "unresolved_identity_withheld";
  if (!person && !explicit) return "unresolved_identity_withheld";
  if (person && !knownWorkContact && !explicit) return "not_work_contact_withheld";
  if (!person && explicit) return "unresolved_identity_withheld";
  return "admitted";
}

function projectIdFor(
  surface: SmsParseSurface,
  identity: SmsIdentityDecision,
  admission: SmsTodayAdmission,
): string | null {
  if (identity.status === "review" || identity.status === "evidence") return null;
  if (!identity.personId) return null;
  if (admission === "unresolved_identity_withheld") return null;
  return surface.message.confirmedProjectId;
}

export function projectSmsObservations(
  inputs: readonly MessageAdapterInput[],
  world: SmsIdentityWorld,
  capturedAt: string,
): SmsBridgeObservation[] {
  const seen = new Set<string>();
  const out: SmsBridgeObservation[] = [];
  for (const input of inputs) {
    const surface = normalizeSmsMessage(input, capturedAt);
    if (seen.has(surface.message.idempotencyKey)) continue;
    seen.add(surface.message.idempotencyKey);
    const internal = messageIsInternal(surface, world);
    const identity = internal
      ? {
          status: "evidence" as const,
          personId: null,
          person: null,
          phoneHash: counterparty(surface).phoneHash,
          personIds: [],
          ruleId: "internal_number" as const,
          mintPerson: false as const,
        }
      : resolvedIdentity(surface, world);
    const admission = smsTodayAdmission({ surface, identity, internal });
    const actor = actorFor({ surface, identity, world, internal });
    const own = authorOwnedText(surface.body);
    const quoted = quotedText(surface.body);
    const files = unique(
      surface.message.attachments
        .map((row) => row.filename ?? "")
        .filter(Boolean),
    );
    const semanticClass: SourceCommunicationEventClass = internal
      ? "unknown_communication"
      : classifySourceCommunication({
          actor,
          direction: surface.message.direction,
          subject: null,
          authorOwnedText: own,
          quotedText: quoted,
          attachmentFilenames: files,
          hasAttachments: surface.message.hasAttachments,
        });
    const identityHay = [own, quoted, ...files].join("\n");
    const cadIds = unique([
      ...currentCadTokensFromIdentityHay([own, ...files]),
      ...(identityHay.match(/\bC\d{5,}\b/gi) ?? []).map((row) => row.toUpperCase()),
    ]);
    const confirmedProjectId = projectIdFor(surface, identity, admission);
    const person =
      identity.status === "review" || !identity.person ? null : identity.person;
    const provenance: SmsObservationProvenance = {
      channel: "sms",
      provider: surface.message.provider,
      ingestClass: surface.message.ingestClass,
      lineClass: surface.message.lineClass,
      capturedAt: surface.message.capturedAt,
      producer: SMS_BRIDGE_PRODUCER,
      identityRule: identity.ruleId,
      personId: person?.personId ?? null,
      todayAdmission: admission,
      idempotencyKey: surface.message.idempotencyKey,
    };
    const event: SourceCommunicationEvent = {
      sourceType: "sms",
      sourceRef: surface.message.sourceRef,
      messageId: surface.message.sourceMessageId,
      threadId: surface.message.conversationKey,
      timestamp: surface.message.sentAt,
      direction: surface.message.direction,
      actor,
      subject: null,
      authorOwnedText: own,
      quotedText: quoted,
      attachmentFilenames: files,
      hasAttachments: surface.message.hasAttachments,
      cadIds,
      orderIds: matches(identityHay, ORDER_ID),
      productionJobIds: matches(identityHay, RN_ID),
      personLabel: person?.displayName?.trim() || null,
      projectId: confirmedProjectId,
      workLoopId: confirmedProjectId
        ? `project:${confirmedProjectId}`
        : `thread:${surface.message.conversationKey}`,
      semanticClass,
      provenance,
    };
    out.push({
      event,
      identity,
      admission,
      createsPerson: false,
      createsProject: false,
      mutationBoundary: SMS_MUTATION_BOUNDARY,
    });
  }
  return out;
}

export function admittedSmsEvents(
  observations: readonly SmsBridgeObservation[],
): SourceCommunicationEvent[] {
  return observations
    .filter((row) => row.admission === "admitted")
    .map((row) => row.event)
    .filter((event) => {
      const provenance = event.provenance;
      return isSmsObservationProvenance(provenance) && provenance.todayAdmission === "admitted";
    });
}

export type SmsTodaySurface = {
  admittedEvents: readonly SourceCommunicationEvent[];
  reduced: ReducedWorkLoopState;
  entersUpNext: boolean;
  isWait: boolean;
};

export function smsTodaySurface(input: {
  observations: readonly SmsBridgeObservation[];
  loopKey: string;
  waitingState?: ThreadWaitingKind | null;
}): SmsTodaySurface {
  const admitted = admittedSmsEvents(input.observations);
  const scoped = sourceEventsForWorkLoop(admitted, { key: input.loopKey });
  const reduced = reduceWorkLoop({
    evidence: [],
    sourceEvents: scoped,
    waitingState: input.waitingState ?? null,
  });
  const entersUpNext =
    reduced.ballHolder === "founder" &&
    reduced.founderOpen &&
    scoped.some((event) => isCurrentWorkSourceClass(event.semanticClass));
  const isWait =
    !reduced.founderOpen &&
    (reduced.ballHolder === "vendor_shop" || reduced.ballHolder === "client");
  return { admittedEvents: scoped, reduced, entersUpNext, isWait };
}
