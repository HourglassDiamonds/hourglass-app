/**
 * Digital-card identity exchange.
 * Resolves a visitor against canonical Person identity — never name-merge.
 */

import { randomUUID } from "node:crypto";
import { unionPersonRoles } from "@/lib/continuum/client-memory/contracts";
import { hashEmail, hashPhone } from "@/lib/continuum/client-memory/hashes";
import { resolvePersonIdentity, type IdentityLookup } from "@/lib/continuum/client-memory/identity";
import type {
  ApplyExistingPersonInput,
  ApplyExistingPersonResult,
  CreatePersonAtomicInput,
  CreatePersonAtomicResult,
} from "@/lib/continuum/client-memory/store";
import type {
  IdentityReview,
  InsertResult,
  PersonProfile,
  PersonRole,
} from "@/lib/continuum/client-memory/types";
import { planContactEnrichment } from "./enrich";
import { parseShareContact } from "./parse";
import {
  DIGITAL_CARD_CREATED_BY,
  DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
  DIGITAL_CARD_SOURCE_SYSTEM,
  type DigitalCard,
  type DigitalCardContext,
  type IdentityExchange,
  type ShareContactInput,
  type ShareContactResult,
  type SubmittedContact,
} from "./types";

const BUSINESS_CONTACT_ROLE: PersonRole = "business-contact";

export type DigitalCardExchangeDeps = {
  nowIso: () => string;
  findActiveIdentities: IdentityLookup["findActiveIdentities"];
  createPersonAtomic: (
    input: CreatePersonAtomicInput,
  ) => Promise<CreatePersonAtomicResult>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  applyExistingPersonAtomic: (
    input: ApplyExistingPersonInput,
  ) => Promise<ApplyExistingPersonResult>;
  insertIdentityReview: (
    row: IdentityReview,
  ) => Promise<InsertResult<IdentityReview>>;
  getPublishedCardBySlug: (slug: string) => Promise<DigitalCard | null>;
  findActiveContextByPublicToken: (
    cardId: string,
    token: string,
  ) => Promise<DigitalCardContext | null>;
  insertExchange: (row: IdentityExchange) => Promise<InsertResult<IdentityExchange>>;
  getExchangeBySubmissionId: (submissionId: string) => Promise<IdentityExchange | null>;
};

function isIdentityRace(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("identity_conflict") ||
    message.includes("duplicate key") ||
    message.includes("23505") ||
    message.includes("continuum_external_identities_active_uq")
  );
}

function identitiesForContact(contact: SubmittedContact, createdAt: string) {
  const identities: ApplyExistingPersonInput["identities"] = [];
  if (contact.email) {
    const identifier = hashEmail(contact.email);
    if (identifier) {
      identities.push({
        identityKind: "email_hash",
        identifier,
        sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
        createdAt,
      });
    }
  }
  if (contact.phone) {
    const identifier = hashPhone(contact.phone);
    if (identifier) {
      identities.push({
        identityKind: "phone_hash",
        identifier,
        sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
        createdAt,
      });
    }
  }
  return identities;
}

async function writeExchange(
  deps: DigitalCardExchangeDeps,
  input: {
    card: DigitalCard;
    contextId: string | null;
    contact: SubmittedContact;
    submissionId: string;
    resolutionStatus: IdentityExchange["resolutionStatus"];
    reasonCode: string;
    counterpartyPersonId: string | null;
  },
): Promise<IdentityExchange> {
  const now = deps.nowIso();
  const existing = await deps.getExchangeBySubmissionId(input.submissionId);
  if (existing) return existing;
  const row: IdentityExchange = {
    id: randomUUID(),
    occurredAt: now,
    cardId: input.card.id,
    cardSlug: input.card.slug,
    contextId: input.contextId,
    ownerUsername: input.card.ownerUsername,
    ownerPersonId: input.card.ownerPersonId,
    counterpartyPersonId: input.counterpartyPersonId,
    eventType: DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    resolutionStatus: input.resolutionStatus,
    reasonCode: input.reasonCode,
    submissionId: input.submissionId,
    submittedContact: input.contact,
    createdAt: now,
  };
  const written = await deps.insertExchange(row);
  return written.record;
}

async function openReview(
  deps: DigitalCardExchangeDeps,
  input: {
    reasonCode: string;
    personIds: string[];
    submissionId: string;
  },
): Promise<void> {
  await deps.insertIdentityReview({
    id: randomUUID(),
    status: "open",
    reasonCode: input.reasonCode,
    leftPersonId: input.personIds[0] ?? null,
    rightPersonId: input.personIds[1] ?? null,
    importRowKey: `continuum-card:${input.submissionId}`,
    issueText: "Digital card identity needs review. Do not auto-merge.",
    resolutionText: null,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: deps.nowIso(),
  });
}

async function enrichMatchedPerson(
  deps: DigitalCardExchangeDeps,
  personId: string,
  contact: SubmittedContact,
): Promise<"ok" | "review"> {
  const existing = await deps.getPersonProfile(personId);
  if (!existing) return "review";
  const now = deps.nowIso();
  const patch = planContactEnrichment(existing, contact);
  const identities = identitiesForContact(contact, now);
  const applied = await deps.applyExistingPersonAtomic({
    personId,
    updatedAt: now,
    profile: patch,
    roles: unionPersonRoles(existing.roles, [BUSINESS_CONTACT_ROLE]),
    identities,
  });
  if (applied.status === "conflict") return "review";
  return "ok";
}

async function recoverExistingCounterparty(
  deps: DigitalCardExchangeDeps,
  contact: SubmittedContact,
): Promise<
  | { status: "matched"; personId: string }
  | { status: "review"; personIds: string[] }
  | { status: "error" }
> {
  const recovered = await resolvePersonIdentity(deps, {
    email: contact.email,
    phone: contact.phone,
  });
  if (recovered.status === "matched" && recovered.personId) {
    return { status: "matched", personId: recovered.personId };
  }
  if (recovered.status === "review") {
    return { status: "review", personIds: recovered.conflictingPersonIds };
  }
  return { status: "error" };
}

async function createCounterparty(
  deps: DigitalCardExchangeDeps,
  contact: SubmittedContact,
): Promise<
  | { status: "created"; personId: string }
  | { status: "matched"; personId: string }
  | { status: "review"; personIds: string[] }
  | { status: "error" }
> {
  const now = deps.nowIso();
  const identities = identitiesForContact(contact, now).map((identity) => ({
    identityKind: identity.identityKind,
    identifier: identity.identifier,
    sourceSystem: identity.sourceSystem,
  }));
  try {
    const created = await deps.createPersonAtomic({
      createdAt: now,
      createdBy: DIGITAL_CARD_CREATED_BY,
      profile: {
        displayName: contact.displayName,
        givenName: contact.givenName,
        familyName: contact.familyName,
        organizationName: contact.company,
        email: contact.email,
        phone: contact.phone,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        roles: [BUSINESS_CONTACT_ROLE],
        sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
        createdAt: now,
        updatedAt: now,
      },
      identities,
    });
    if (created.status === "already-present") {
      return recoverExistingCounterparty(deps, contact);
    }
    return { status: "created", personId: created.personId };
  } catch (error) {
    if (!isIdentityRace(error)) return { status: "error" };
    return recoverExistingCounterparty(deps, contact);
  }
}

function trimHoneypot(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function ingestDigitalCardShare(
  deps: DigitalCardExchangeDeps,
  input: ShareContactInput,
): Promise<ShareContactResult> {
  if (trimHoneypot(input.honeypot)) {
    return { status: "ignored" };
  }

  const parsed = parseShareContact(input);
  if (!parsed.ok) {
    return { status: "validation-error", code: parsed.code, message: parsed.message };
  }

  const slug = input.slug.trim().toLowerCase();
  const card = await deps.getPublishedCardBySlug(slug);
  if (!card) {
    return {
      status: "validation-error",
      code: "card-not-found",
      message: "This card is no longer available.",
    };
  }

  const duplicate = await deps.getExchangeBySubmissionId(parsed.submissionId);
  if (duplicate) {
    return {
      status: "accepted",
      resolution: duplicate.resolutionStatus,
      exchangeId: duplicate.id,
    };
  }

  const contextToken = input.contextToken?.trim() ?? "";
  const context = contextToken
    ? await deps.findActiveContextByPublicToken(card.id, contextToken)
    : null;

  const hasIdentity = Boolean(parsed.value.email || parsed.value.phone);
  if (!hasIdentity) {
    await openReview(deps, {
      reasonCode: "REVIEW_NAME_ONLY_NEVER_MERGE",
      personIds: [],
      submissionId: parsed.submissionId,
    });
    const exchange = await writeExchange(deps, {
      card,
      contextId: context?.id ?? null,
      contact: parsed.value,
      submissionId: parsed.submissionId,
      resolutionStatus: "review",
      reasonCode: "REVIEW_NAME_ONLY_NEVER_MERGE",
      counterpartyPersonId: null,
    });
    return { status: "accepted", resolution: "review", exchangeId: exchange.id };
  }

  try {
    const resolution = await resolvePersonIdentity(deps, {
      email: parsed.value.email,
      phone: parsed.value.phone,
      displayName: parsed.value.displayName,
    });

    if (resolution.status === "matched" && resolution.personId) {
      const enrich = await enrichMatchedPerson(deps, resolution.personId, parsed.value);
      if (enrich === "review") {
        await openReview(deps, {
          reasonCode: "REVIEW_IDENTITY_COLLISION",
          personIds: [resolution.personId],
          submissionId: parsed.submissionId,
        });
        const exchange = await writeExchange(deps, {
          card,
          contextId: context?.id ?? null,
          contact: parsed.value,
          submissionId: parsed.submissionId,
          resolutionStatus: "review",
          reasonCode: "REVIEW_IDENTITY_COLLISION",
          counterpartyPersonId: resolution.personId,
        });
        return { status: "accepted", resolution: "review", exchangeId: exchange.id };
      }
      const exchange = await writeExchange(deps, {
        card,
        contextId: context?.id ?? null,
        contact: parsed.value,
        submissionId: parsed.submissionId,
        resolutionStatus: "matched",
        reasonCode: resolution.reasonCode,
        counterpartyPersonId: resolution.personId,
      });
      return { status: "accepted", resolution: "matched", exchangeId: exchange.id };
    }

    if (resolution.status === "review") {
      await openReview(deps, {
        reasonCode: resolution.reasonCode,
        personIds: resolution.conflictingPersonIds,
        submissionId: parsed.submissionId,
      });
      const exchange = await writeExchange(deps, {
        card,
        contextId: context?.id ?? null,
        contact: parsed.value,
        submissionId: parsed.submissionId,
        resolutionStatus: "review",
        reasonCode: resolution.reasonCode,
        counterpartyPersonId: null,
      });
      return { status: "accepted", resolution: "review", exchangeId: exchange.id };
    }

    if (resolution.status === "invalid") {
      return {
        status: "validation-error",
        code: "invalid-email",
        message: "Enter a valid email or mobile number.",
      };
    }

    const created = await createCounterparty(deps, parsed.value);
    if (created.status === "error") return { status: "error" };
    if (created.status === "review") {
      await openReview(deps, {
        reasonCode: "REVIEW_IDENTITY_COLLISION",
        personIds: created.personIds,
        submissionId: parsed.submissionId,
      });
      const exchange = await writeExchange(deps, {
        card,
        contextId: context?.id ?? null,
        contact: parsed.value,
        submissionId: parsed.submissionId,
        resolutionStatus: "review",
        reasonCode: "REVIEW_IDENTITY_COLLISION",
        counterpartyPersonId: null,
      });
      return { status: "accepted", resolution: "review", exchangeId: exchange.id };
    }

    if (created.status === "matched") {
      await enrichMatchedPerson(deps, created.personId, parsed.value);
      const exchange = await writeExchange(deps, {
        card,
        contextId: context?.id ?? null,
        contact: parsed.value,
        submissionId: parsed.submissionId,
        resolutionStatus: "matched",
        reasonCode: "MATCHED_AFTER_RACE",
        counterpartyPersonId: created.personId,
      });
      return { status: "accepted", resolution: "matched", exchangeId: exchange.id };
    }

    const exchange = await writeExchange(deps, {
      card,
      contextId: context?.id ?? null,
      contact: parsed.value,
      submissionId: parsed.submissionId,
      resolutionStatus: "created",
      reasonCode: "NEW_PERSON",
      counterpartyPersonId: created.personId,
    });
    return { status: "accepted", resolution: "created", exchangeId: exchange.id };
  } catch {
    return { status: "error" };
  }
}
