/**
 * Conservative identity resolution across Gmail, HubSpot, and Concierge.
 * Name-only matching is never sufficient.
 */

import {
  normalizeEmail,
  normalizePhone,
  safeDisplayName,
  subjectKeyFromContactId,
  subjectKeyFromEmail,
  subjectKeyFromSubmissionId,
  subjectKeyFromThreadId,
} from "./hash";
import type { ClientAttentionSourceType } from "./source-of-truth";
import type { ClientAttentionSourceBundle } from "./adapters/types";

export type IdentityProvenance = {
  sourceType: ClientAttentionSourceType;
  kind:
    | "email"
    | "contact-id"
    | "submission-mapping"
    | "phone"
    | "deal-association"
    | "thread";
  sourceObjectId: string;
};

export type ResolvedClientIdentity = {
  subjectKey: string;
  resolved: boolean;
  confidence: "high" | "medium" | "low";
  displayName: string;
  /** Internal only — stripped before founder output / audit serialization. */
  normalizedEmail?: string;
  normalizedPhone?: string;
  contactIds: string[];
  dealIds: string[];
  threadIds: string[];
  submissionIds: string[];
  sourceTypes: ClientAttentionSourceType[];
  provenance: IdentityProvenance[];
  matchReasons: string[];
};

export type IdentityResolutionResult = {
  identities: ResolvedClientIdentity[];
  unresolvedCount: number;
  resolvedCount: number;
  possibleDuplicatePairs: Array<{
    leftSubjectKey: string;
    rightSubjectKey: string;
    reason: string;
  }>;
};

type MutableIdentity = ResolvedClientIdentity;

export function resolveClientIdentities(
  bundle: ClientAttentionSourceBundle,
): IdentityResolutionResult {
  const identities: MutableIdentity[] = [];
  const byEmail = new Map<string, MutableIdentity>();
  const byContactId = new Map<string, MutableIdentity>();
  const byPhone = new Map<string, MutableIdentity>();

  const ensure = (seed: Partial<MutableIdentity> & { subjectKey: string }) => {
    let existing = identities.find((i) => i.subjectKey === seed.subjectKey);
    if (!existing) {
      existing = {
        subjectKey: seed.subjectKey,
        resolved: seed.resolved ?? false,
        confidence: seed.confidence ?? "low",
        displayName: seed.displayName ?? "A client",
        normalizedEmail: seed.normalizedEmail,
        normalizedPhone: seed.normalizedPhone,
        contactIds: seed.contactIds ?? [],
        dealIds: seed.dealIds ?? [],
        threadIds: seed.threadIds ?? [],
        submissionIds: seed.submissionIds ?? [],
        sourceTypes: seed.sourceTypes ?? [],
        provenance: seed.provenance ?? [],
        matchReasons: seed.matchReasons ?? [],
      };
      identities.push(existing);
    }
    return existing;
  };

  const findByEmail = (email: string | undefined) => {
    const n = normalizeEmail(email);
    return n ? byEmail.get(n) : undefined;
  };

  // 1) HubSpot contacts — strong identity anchors
  for (const contact of bundle.hubspot.contacts) {
    const email = normalizeEmail(contact.normalizedEmail);
    const phone = normalizePhone(contact.normalizedPhone);
    let identity =
      (email && byEmail.get(email)) ||
      byContactId.get(contact.contactId) ||
      (phone && byPhone.get(phone));

    if (!identity) {
      const subjectKey = email
        ? subjectKeyFromEmail(email)
        : subjectKeyFromContactId(contact.contactId);
      identity = ensure({
        subjectKey,
        resolved: Boolean(email || contact.contactId),
        confidence: email ? "high" : "medium",
        displayName: safeDisplayName({
          firstName: contact.firstName,
          lastName: contact.lastName,
        }),
        normalizedEmail: email ?? undefined,
        normalizedPhone: phone ?? undefined,
        contactIds: [contact.contactId],
        sourceTypes: ["hubspot"],
        provenance: [
          {
            sourceType: "hubspot",
            kind: "contact-id",
            sourceObjectId: contact.contactId,
          },
        ],
        matchReasons: ["hubspot-contact"],
      });
    } else {
      identity.contactIds = unique([...identity.contactIds, contact.contactId]);
      identity.sourceTypes = unique([
        ...identity.sourceTypes,
        "hubspot",
      ]) as ClientAttentionSourceType[];
      identity.provenance.push({
        sourceType: "hubspot",
        kind: "contact-id",
        sourceObjectId: contact.contactId,
      });
      identity.displayName = safeDisplayName({
        firstName: contact.firstName,
        lastName: contact.lastName,
        fallback: identity.displayName,
      });
      if (email) identity.normalizedEmail = email;
      if (phone) identity.normalizedPhone = phone;
      identity.resolved = true;
      identity.confidence = upgradeConfidence(identity.confidence, "high");
    }

    byContactId.set(contact.contactId, identity);
    if (email) byEmail.set(email, identity);
    if (phone) byPhone.set(phone, identity);
  }

  // 2) HubSpot deals — associate by contact id
  for (const deal of bundle.hubspot.deals) {
    for (const contactId of deal.contactIds) {
      const identity = byContactId.get(contactId);
      if (!identity) continue;
      identity.dealIds = unique([...identity.dealIds, deal.dealId]);
      identity.provenance.push({
        sourceType: "hubspot",
        kind: "deal-association",
        sourceObjectId: deal.dealId,
      });
      identity.matchReasons = unique([
        ...identity.matchReasons,
        "deal-contact-association",
      ]);
    }
  }

  // 3) Concierge submissions — email, contact mapping, phone
  for (const sub of bundle.concierge.submissions) {
    const email = normalizeEmail(sub.normalizedEmail);
    const phone = normalizePhone(sub.normalizedPhone);
    let identity =
      (sub.hubspotContactId && byContactId.get(sub.hubspotContactId)) ||
      findByEmail(email ?? undefined) ||
      (phone && byPhone.get(phone));

    if (!identity) {
      const subjectKey = email
        ? subjectKeyFromEmail(email)
        : sub.hubspotContactId
          ? subjectKeyFromContactId(sub.hubspotContactId)
          : subjectKeyFromSubmissionId(sub.submissionId);
      identity = ensure({
        subjectKey,
        resolved: Boolean(email || sub.hubspotContactId),
        confidence: email || sub.hubspotContactId ? "high" : "low",
        displayName: safeDisplayName({
          firstName: sub.firstName,
          lastName: sub.lastName,
          fullName: sub.fullName,
        }),
        normalizedEmail: email ?? undefined,
        normalizedPhone: phone ?? undefined,
        contactIds: sub.hubspotContactId ? [sub.hubspotContactId] : [],
        dealIds: sub.hubspotDealId ? [sub.hubspotDealId] : [],
        submissionIds: [sub.submissionId],
        sourceTypes: ["concierge"],
        provenance: [
          {
            sourceType: "concierge",
            kind: sub.hubspotContactId ? "submission-mapping" : "email",
            sourceObjectId: sub.submissionId,
          },
        ],
        matchReasons: sub.hubspotContactId
          ? ["concierge-hubspot-mapping"]
          : email
            ? ["concierge-email"]
            : ["concierge-unresolved"],
      });
    } else {
      identity.submissionIds = unique([
        ...identity.submissionIds,
        sub.submissionId,
      ]);
      if (sub.hubspotContactId) {
        identity.contactIds = unique([
          ...identity.contactIds,
          sub.hubspotContactId,
        ]);
        byContactId.set(sub.hubspotContactId, identity);
        identity.matchReasons = unique([
          ...identity.matchReasons,
          "concierge-hubspot-mapping",
        ]);
      }
      if (sub.hubspotDealId) {
        identity.dealIds = unique([...identity.dealIds, sub.hubspotDealId]);
      }
      identity.sourceTypes = unique([
        ...identity.sourceTypes,
        "concierge",
      ]) as ClientAttentionSourceType[];
      identity.provenance.push({
        sourceType: "concierge",
        kind: "submission-mapping",
        sourceObjectId: sub.submissionId,
      });
      identity.displayName = safeDisplayName({
        firstName: sub.firstName,
        lastName: sub.lastName,
        fullName: sub.fullName,
        fallback: identity.displayName,
      });
      identity.resolved = true;
      identity.confidence = upgradeConfidence(identity.confidence, "high");
      identity.matchReasons = unique([
        ...identity.matchReasons,
        email ? "exact-email" : "concierge-merge",
      ]);
    }

    if (email) byEmail.set(email, identity);
    if (phone) byPhone.set(phone, identity);
  }

  // 4) Gmail threads — email merge; support multiple threads per contact
  for (const thread of bundle.gmail.threads) {
    if (thread.automated || !thread.businessRelevant) continue;
    const email = normalizeEmail(thread.normalizedPrimaryEmail);
    let identity = email ? byEmail.get(email) : undefined;

    if (!identity) {
      const subjectKey = email
        ? subjectKeyFromEmail(email)
        : subjectKeyFromThreadId(thread.threadId);
      identity = ensure({
        subjectKey,
        resolved: Boolean(email),
        confidence: email ? "medium" : "low",
        displayName: thread.safeParticipantLabel ?? "A client",
        normalizedEmail: email ?? undefined,
        threadIds: [thread.threadId],
        sourceTypes: ["gmail"],
        provenance: [
          {
            sourceType: "gmail",
            kind: "thread",
            sourceObjectId: thread.threadId,
          },
        ],
        matchReasons: email ? ["gmail-email"] : ["gmail-unresolved"],
      });
    } else {
      identity.threadIds = unique([...identity.threadIds, thread.threadId]);
      identity.sourceTypes = unique([
        ...identity.sourceTypes,
        "gmail",
      ]) as ClientAttentionSourceType[];
      identity.provenance.push({
        sourceType: "gmail",
        kind: "thread",
        sourceObjectId: thread.threadId,
      });
      if (thread.safeParticipantLabel && identity.displayName === "A client") {
        identity.displayName = thread.safeParticipantLabel;
      }
      identity.matchReasons = unique([
        ...identity.matchReasons,
        "gmail-hubspot-email",
      ]);
      identity.resolved = Boolean(identity.normalizedEmail || identity.contactIds.length);
      identity.confidence = upgradeConfidence(
        identity.confidence,
        identity.contactIds.length ? "high" : "medium",
      );
    }

    if (email) byEmail.set(email, identity);
  }

  // Case-insensitive email already handled via normalizeEmail.
  // Same display name + different emails must remain separate — no name merge.

  // Possible duplicates: same last-initial display name pattern with different emails
  // only flagged when both have contact records and near-identical first+last — still
  // we never auto-merge; surface as possible duplicate for DataGap when actionable.
  const possibleDuplicatePairs: IdentityResolutionResult["possibleDuplicatePairs"] =
    [];
  for (let i = 0; i < identities.length; i++) {
    for (let j = i + 1; j < identities.length; j++) {
      const a = identities[i];
      const b = identities[j];
      if (
        a.displayName === b.displayName &&
        a.displayName !== "A client" &&
        a.normalizedEmail &&
        b.normalizedEmail &&
        a.normalizedEmail !== b.normalizedEmail &&
        a.contactIds.length &&
        b.contactIds.length
      ) {
        possibleDuplicatePairs.push({
          leftSubjectKey: a.subjectKey,
          rightSubjectKey: b.subjectKey,
          reason: "same-safe-display-name-different-email",
        });
      }
    }
  }

  const resolvedCount = identities.filter((i) => i.resolved).length;
  return {
    identities,
    resolvedCount,
    unresolvedCount: identities.length - resolvedCount,
    possibleDuplicatePairs,
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function upgradeConfidence(
  current: "high" | "medium" | "low",
  next: "high" | "medium" | "low",
): "high" | "medium" | "low" {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[next] > rank[current] ? next : current;
}
