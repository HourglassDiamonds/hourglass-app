/**
 * Pure founder-attention classification over Candidates.
 * Shared by CoS presentation and Gmail scan-summary. Not React. Not ingestion.
 * Does not delete Candidates, write Open Jobs, or resolve work.
 *
 * Model: cos-founder-attention-v1
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { hashStoredPersonEmail } from "@/lib/continuum/client-memory/hashes";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { isUnresolvedOpenJobState } from "@/lib/continuum/client-memory/project-jobs/validate";
import {
  addCalendarDays,
  civilDateInZone,
  dateOnlyFromParts,
  isPastDueDate,
} from "@/lib/continuum/date-only";
import {
  collectExactGmailIds,
  exactGmailIdsFromCandidate,
  exactGmailIdsFromPointer,
} from "@/lib/continuum/candidates/exact-gmail-ids";
import { isStructuredSpecSourceProvenance } from "@/lib/continuum/candidates/spec-provenance";
import { classifyIdentifierRole } from "@/lib/continuum/candidates/identifier-role";
import {
  isDesignStageSpecField,
  isPersonBoundFingerSizeText,
  isTerminalTodayLifecycle,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";

export const FOUNDER_ATTENTION_MODEL_ID = "cos-founder-attention-v1" as const;

export const FOUNDER_ATTENTION_LANES = [
  "decision",
  "signal",
  "anomaly",
  "background",
] as const;

export type FounderAttentionLane = (typeof FOUNDER_ATTENTION_LANES)[number];

export const COS_DECISION_TARGET = 3 as const;
export const COS_SIGNAL_TARGET = 3 as const;
export const COS_ANOMALY_TARGET = 2 as const;
export const COS_ORDINARY_VISIBLE_TARGET = 8 as const;
export const FOUNDER_ATTENTION_NOVELTY_MS = 7 * 86_400_000;
export const EXPLICIT_NEW_PROJECT_RULE = "explicit_new_project_request";

export const FOUNDER_ATTENTION_FACTOR_IDS = [
  "source_type",
  "commercial_relevance",
  "commitment_complete",
  "commitment_fragment",
  "ownership_founder",
  "novelty",
  "already_represented",
  "canonical_mismatch",
  "project_state_change",
  "subordinate_evidence",
  "urgency",
  "confidence",
  "channel_meta",
  "signature",
  "operational_logistics",
] as const;

export type FounderAttentionFactorId =
  (typeof FOUNDER_ATTENTION_FACTOR_IDS)[number];

export type FounderAttentionJudgment = {
  lane: FounderAttentionLane;
  /** Internal only. Never shown to the founder. */
  score: number;
  factors: FounderAttentionFactorId[];
  candidateId: string;
};

export type FounderAttentionContext = {
  jobs: readonly ProjectJob[];
  nowIso: string;
  top5Ids?: ReadonlySet<string>;
  currentProjectIds?: ReadonlySet<string>;
  specByProject?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  lifecycleByProject?: ReadonlyMap<string, string | null>;
};

const STUDIO_LABELS = new Set(["hourglass", "studio", "the studio", "the house"]);

export function isStudioOrVendorLabel(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (STUDIO_LABELS.has(normalized)) return true;
  return /\bhourglass diamonds\b/.test(normalized);
}

function normalizedIdentity(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isFounderIdentityName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizedIdentity(name);
  if (!normalized) return false;
  if (normalized === "justin" || normalized === "justin smith") return true;
  return (
    normalized.startsWith("justin smith ") ||
    normalized.startsWith("justin smith,")
  );
}

const VENDOR_ORG_TOKEN = "[A-Za-z][A-Za-z0-9'&.\\-]{1,}";
const VENDOR_ORG_PHRASE = new RegExp(
  `\\b(${VENDOR_ORG_TOKEN}(?:\\s+${VENDOR_ORG_TOKEN}){0,2}\\s+(?:Engraving|Jewelers?|Jewellery|Jewelry|Workshop|Atelier))\\b`,
  "i",
);
const VENDOR_PRINTS_PHRASE =
  /\b([A-Za-z][A-Za-z0-9'&.\-]{1,}(?:prints?|stampings?|castings?))\b/i;

export function isVendorOrganizationLabel(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizedIdentity(name);
  if (!normalized) return false;
  if (isStudioOrVendorLabel(normalized)) return true;
  if (/\b(engraving|jewelers?|workshop|atelier|the shop)\b/.test(normalized)) {
    return true;
  }
  if (/(?:prints?|stampings?|castings?)$/.test(normalized)) return true;
  return /\b(support|helpdesk)\b/.test(normalized);
}

function collapseIdentityText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function vendorOrganizationFromIdentityText(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const stripped = collapseIdentityText(text).replace(/^(?:re|fw|fwd):\s*/i, "");
  if (!stripped) return null;
  const phrase = stripped.match(VENDOR_ORG_PHRASE)?.[1]?.trim() ?? null;
  if (phrase && isVendorOrganizationLabel(phrase)) return collapseIdentityText(phrase);
  const prints = stripped.match(VENDOR_PRINTS_PHRASE)?.[1]?.trim() ?? null;
  if (prints && isVendorOrganizationLabel(prints) && prints.length <= 40) {
    return collapseIdentityText(prints);
  }
  if (
    stripped.length <= 60 &&
    isVendorOrganizationLabel(stripped) &&
    !/\b(the shop)\b/i.test(stripped) &&
    !/\bx\b/i.test(stripped) &&
    !/\b(ticket|unsubscribe|in progress|answered)\b/i.test(stripped)
  ) {
    return collapseIdentityText(stripped);
  }
  return null;
}

export type TodayGmailIndexedMessage = {
  messageId: string;
  sentAt: string;
  direction: "inbound" | "outbound" | "unknown";
  labelIds?: readonly string[];
  fromEmailHash?: string | null;
};

export type TodayGmailThreadContext = {
  subject?: string | null;
  fromDisplayName?: string | null;
  fromEmail?: string | null;
  liveIdentityLoaded?: boolean;
  messages?: readonly TodayGmailIndexedMessage[];
};

export type TodayKnownPerson = {
  personId: string;
  displayName: string;
  roles?: readonly string[] | null;
  organizationName?: string | null;
  emailHash: string;
};

const CONSUMER_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
]);

function emailDomain(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

const PROMOTIONAL_ESP_DOMAINS = [
  "ccsend.com",
  "constantcontact.com",
  "mailchimp.com",
  "list-manage.com",
  "campaign-archive.com",
  "sendgrid.net",
  "amazonses.com",
  "mailgun.org",
  "sparkpostmail.com",
  "exacttarget.com",
  "klaviyo.com",
  "hubspotemail.net",
  "mailerlite.com",
  "convertkit.com",
] as const;

const PROMOTIONAL_SENDER_MARK =
  /\b(?:via\s+(?:constant contact|mailchimp|klaviyo|hubspot)|constant contact)\b/i;
const PROMOTIONAL_ESP_HOST =
  /\b[\w.-]+\.(?:ccsend|constantcontact|list-manage|campaign-archive|mailchimp|sendgrid|amazonses|mailgun|sparkpostmail|exacttarget|klaviyo|hubspotemail|mailerlite|convertkit)\.[\w.-]+\b/i;
const MATERIAL_OR_PRODUCT_NOUNS = new Set([
  "platinum",
  "gold",
  "white",
  "yellow",
  "rose",
  "palladium",
  "silver",
  "diamond",
  "diamonds",
  "emerald",
  "sapphire",
  "ruby",
  "ring",
  "rings",
  "pendant",
  "necklace",
  "bracelet",
  "earring",
  "earrings",
  "band",
  "setting",
  "prong",
  "prongs",
  "cad",
  "render",
  "metal",
]);

function isPromotionalEspDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PROMOTIONAL_ESP_DOMAINS.some(
    (esp) => domain === esp || domain.endsWith(`.${esp}`),
  );
}

export function isPromotionalSenderInfrastructure(input: {
  fromEmail?: string | null;
  fromDisplayName?: string | null;
  haystack?: string | null;
}): boolean {
  if (isPromotionalEspDomain(emailDomain(input.fromEmail ?? null))) return true;
  const hay = `${input.fromEmail ?? ""} ${input.fromDisplayName ?? ""} ${input.haystack ?? ""}`;
  return PROMOTIONAL_SENDER_MARK.test(hay) || PROMOTIONAL_ESP_HOST.test(hay);
}

export function isRecoverableExternalHumanSender(input: {
  thread?: TodayGmailThreadContext | null;
  haystack?: string | null;
}): boolean {
  if (
    isPromotionalSenderInfrastructure({
      fromEmail: input.thread?.fromEmail,
      fromDisplayName: input.thread?.fromDisplayName,
      haystack: input.haystack,
    })
  ) {
    return false;
  }
  if (isPlatformOrSystemName(input.thread?.fromDisplayName)) return false;
  if (isSupplierOrSystemMailbox(input.thread?.fromEmail)) return false;
  const local = emailLocalPart(input.thread?.fromEmail ?? null);
  if (isPlatformOrSystemName(local)) return false;
  const name = input.thread?.fromDisplayName?.trim() ?? "";
  if (looksLikeHumanPersonName(name)) return true;
  const email = input.thread?.fromEmail?.trim() ?? "";
  if (!email) return false;
  if (isPromotionalEspDomain(emailDomain(email))) return false;
  return true;
}

function isStudioMailboxDomain(domain: string): boolean {
  return domain === "hourglassdiamonds.com" || domain.endsWith(".hourglassdiamonds.com");
}

function domainRegistrableLabel(domain: string): string | null {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const label = parts[parts.length - 2]?.trim() ?? "";
  return label.length >= 3 ? label : null;
}

function orgKey(value: string): string {
  return normalizedIdentity(value);
}

export function collectTodayVendorEvidence(input: {
  people?: readonly TodayIdentitySignal[];
  evidenceTexts?: readonly string[];
}): { directory: string[]; evidenceTexts: string[] } {
  const directory: string[] = [];
  const evidenceTexts: string[] = [...(input.evidenceTexts ?? [])];
  for (const person of input.people ?? []) {
    const organization = person.organizationName?.trim() ?? "";
    if (organization) {
      evidenceTexts.push(organization);
      const roles = person.roles ?? [];
      if (
        roles.includes("vendor-contact") ||
        roles.includes("business-contact") ||
        isVendorOrganizationLabel(organization)
      ) {
        directory.push(collapseIdentityText(organization));
      }
    }
    if (isVendorOrganizationLabel(person.displayName)) {
      directory.push(collapseIdentityText(person.displayName));
    }
  }
  return {
    directory: [...new Set(directory.filter(Boolean))],
    evidenceTexts: [...new Set(evidenceTexts.map((row) => row.trim()).filter(Boolean))],
  };
}

function compatiblePrefixFamily(unique: readonly string[]): string | null {
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0]!;
  const longest = [...unique].sort((a, b) => b.length - a.length)[0]!;
  if (!unique.every((key) => longest.startsWith(key))) return null;
  return [...unique].sort((a, b) => a.length - b.length)[0]!;
}

function domainLooksLikeVendorContext(label: string): boolean {
  return /jewel|workshop|atelier|engrav|casting|stamping|gemlab/.test(orgKey(label));
}

function vendorOrgFromDomainEvidence(
  label: string,
  directory: readonly string[],
  evidenceTexts: readonly string[],
): string | null {
  const labelKey = orgKey(label);
  if (!labelKey) return null;
  const directoryHit = directory.find((org) => {
    const key = orgKey(org);
    if (!key) return false;
    if (key === labelKey || labelKey.startsWith(key)) return true;
    const first = key.split(" ")[0] ?? "";
    return first.length >= 4 && (first === labelKey || labelKey.startsWith(first));
  });
  if (directoryHit) return directoryHit;
  const tokens = [
    ...new Set(
      evidenceTexts
        .join("\n")
        .split(/[^A-Za-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  ];
  const prefixHits = tokens.filter((token) => labelKey.startsWith(orgKey(token)));
  const unique = [...new Set(prefixHits.map((token) => orgKey(token)))];
  const family = compatiblePrefixFamily(unique);
  if (!family) {
    return domainLooksLikeVendorContext(label) ? collapseIdentityText(label) : null;
  }
  const matched = prefixHits.find((token) => orgKey(token) === family) ?? null;
  return matched ? collapseIdentityText(matched) : collapseIdentityText(label);
}

export function vendorOrganizationFromGmailContext(input: {
  thread?: TodayGmailThreadContext | null;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
}): string | null {
  const fromSubject = vendorOrganizationFromIdentityText(input.thread?.subject ?? null);
  if (fromSubject) return fromSubject;
  const fromName = vendorOrganizationFromIdentityText(input.thread?.fromDisplayName ?? null);
  if (fromName) return fromName;
  if (isVendorOrganizationLabel(input.thread?.fromDisplayName)) {
    return collapseIdentityText(input.thread!.fromDisplayName!);
  }
  const directory = (input.vendorDirectory ?? [])
    .map((row) => collapseIdentityText(row))
    .filter(Boolean);
  const display = collapseIdentityText(input.thread?.fromDisplayName ?? "");
  if (display) {
    const displayHit = directory.find(
      (org) => orgKey(display) === orgKey(org) || orgKey(display).includes(orgKey(org)),
    );
    if (displayHit) return displayHit;
  }
  const domain = emailDomain(input.thread?.fromEmail ?? null);
  if (!domain || CONSUMER_MAIL_DOMAINS.has(domain) || isStudioMailboxDomain(domain)) {
    return null;
  }
  const label = domainRegistrableLabel(domain);
  if (!label) return null;
  return vendorOrgFromDomainEvidence(label, directory, input.evidenceTexts ?? []);
}

export function pickTodayVendorContext(input: {
  candidates?: readonly ContinuumCandidate[];
  people?: readonly TodayIdentitySignal[];
  thread?: TodayGmailThreadContext | null;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
}): string | null {
  const people: TodayIdentitySignal[] = [...(input.people ?? [])];
  for (const row of input.candidates ?? []) {
    const payload = payloadOf(row);
    if (payload.kind === "person_association" && payload.displayName) {
      people.push({
        displayName: payload.displayName,
        roles: null,
        organizationName: null,
      });
    }
  }
  const contacts = people.filter((person) => {
    if (isFounderIdentityName(person.displayName)) return false;
    if (isPlatformOrSystemName(person.displayName)) return false;
    const roles = person.roles ?? [];
    return roles.includes("vendor-contact") && looksLikeHumanPersonName(person.displayName);
  });
  if (contacts.length === 1) {
    const name = contacts[0]?.displayName.trim() ?? "";
    if (name) return name;
  }
  const collected = collectTodayVendorEvidence({
    people,
    evidenceTexts: input.evidenceTexts,
  });
  const directory = [
    ...new Set([...(input.vendorDirectory ?? []), ...collected.directory]),
  ];
  const orgs = people.flatMap((person) => {
    if (isFounderIdentityName(person.displayName)) return [];
    if (isPlatformOrSystemName(person.displayName)) return [];
    if (isVendorOrganizationLabel(person.displayName)) {
      return [collapseIdentityText(person.displayName)];
    }
    const organization = person.organizationName?.trim() ?? "";
    if (organization && isVendorOrganizationLabel(organization)) {
      return [collapseIdentityText(organization)];
    }
    if (
      (person.roles ?? []).includes("vendor-contact") &&
      organization &&
      !isFounderIdentityName(organization) &&
      !isPlatformOrSystemName(organization)
    ) {
      return [collapseIdentityText(organization)];
    }
    const extracted = vendorOrganizationFromIdentityText(person.displayName);
    return extracted ? [extracted] : [];
  });
  const uniqueOrgs = [...new Set(orgs)];
  if (uniqueOrgs.length === 1) return uniqueOrgs[0]!;
  for (const row of input.candidates ?? []) {
    const payload = payloadOf(row);
    if (payload.kind !== "project_context") continue;
    const fromValue = vendorOrganizationFromIdentityText(payload.value);
    if (fromValue) return fromValue;
  }
  const fromGmail = vendorOrganizationFromGmailContext({
    thread: input.thread,
    vendorDirectory: directory,
    evidenceTexts: collected.evidenceTexts,
  });
  if (fromGmail) return fromGmail;
  const vendorThread =
    uniqueOrgs.length > 0 ||
    people.some((person) => isVendorPerson(person)) ||
    (input.candidates ?? []).some((row) => hasVendorRule(row));
  if (vendorThread) {
    const humans = people.filter(
      (person) =>
        looksLikeHumanPersonName(person.displayName) &&
        !isFounderIdentityName(person.displayName),
    );
    const uniqueHumans = [...new Set(humans.map((person) => person.displayName.trim()))];
    if (uniqueHumans.length === 1) return uniqueHumans[0]!;
  }
  return uniqueOrgs[0] ?? null;
}

export type TodayResolvedIdentity = {
  kind: "person" | "vendor" | "ambiguous" | "unresolved";
  personId: string | null;
  personLabel: string | null;
  organizationLabel: string | null;
};

export function resolveTodayIdentity(input: {
  emailHashes?: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
  candidates?: readonly ContinuumCandidate[];
  people?: readonly TodayIdentitySignal[];
  thread?: TodayGmailThreadContext | null;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
}): TodayResolvedIdentity {
  const known = resolveUniqueKnownPerson({
    emailHashes: input.emailHashes ?? collectTodayEmailHashes(input),
    knownPeople: input.knownPeople,
  });
  const gmailVendor = vendorOrganizationFromGmailContext({
    thread: input.thread,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
  });
  const pickedVendor = pickTodayVendorContext({
    candidates: input.candidates,
    people: input.people,
    thread: input.thread,
    vendorDirectory: input.vendorDirectory,
    evidenceTexts: input.evidenceTexts,
  });
  const vendorLabel =
    gmailVendor ||
    (pickedVendor &&
    (isVendorOrganizationLabel(pickedVendor) || !looksLikeHumanPersonName(pickedVendor))
      ? pickedVendor
      : null);
  if (vendorLabel) {
    return {
      kind: "vendor",
      personId: null,
      personLabel: null,
      organizationLabel: vendorLabel,
    };
  }
  if (known === "ambiguous") {
    return {
      kind: "ambiguous",
      personId: null,
      personLabel: null,
      organizationLabel: null,
    };
  }
  const knownVendor =
    Boolean(known) &&
    isVendorPerson({
      displayName: known!.displayName,
      roles: known!.roles,
      organizationName: known!.organizationName,
    });
  if (known && isClientPersonLabel(known.displayName) && !knownVendor) {
    return {
      kind: "person",
      personId: known.personId,
      personLabel: known.displayName,
      organizationLabel: null,
    };
  }
  if (knownVendor) {
    const organization =
      known!.organizationName?.trim() ||
      (isVendorOrganizationLabel(known!.displayName) ? known!.displayName.trim() : "");
    if (organization) {
      return {
        kind: "vendor",
        personId: null,
        personLabel: null,
        organizationLabel: collapseIdentityText(organization),
      };
    }
  }
  if (pickedVendor) {
    return {
      kind: "vendor",
      personId: null,
      personLabel: null,
      organizationLabel: pickedVendor,
    };
  }
  return {
    kind: "unresolved",
    personId: null,
    personLabel: null,
    organizationLabel: null,
  };
}

export function isPlatformOrSystemName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizedIdentity(name);
  if (!normalized) return false;
  if (
    /\b(noreply|no-reply|notifications?|mailer|newsletter|digest|mailer-daemon|postmaster|product updates?)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\b(air lines?|airlines?|airways)\b/.test(normalized)) return true;
  if (/\b(inc|llc|ltd|gmbh|corp)\.?\b/.test(normalized)) return true;
  const tokens = normalized.split(" ");
  return tokens.length === 1 && normalized.length >= 6 && /(?:base|cloud|hq)$/.test(normalized);
}

export function isVendorPerson(person: {
  displayName: string;
  roles?: readonly string[] | null;
  organizationName?: string | null;
}): boolean {
  const roles = person.roles ?? [];
  if (roles.includes("vendor-contact")) return true;
  if (roles.includes("business-contact") && !roles.includes("client")) return true;
  if (isVendorOrganizationLabel(person.displayName)) return true;
  return isVendorOrganizationLabel(person.organizationName);
}

export function looksLikeHumanPersonName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  if (isFounderIdentityName(name)) return false;
  if (isStudioOrVendorLabel(name)) return false;
  if (isVendorOrganizationLabel(name)) return false;
  if (isPlatformOrSystemName(name)) return false;
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 1 || tokens.length > 4) return false;
  if (
    tokens.length === 1 &&
    MATERIAL_OR_PRODUCT_NOUNS.has(tokens[0]!.toLowerCase().replace(/[^a-z]/g, ""))
  ) {
    return false;
  }
  return tokens.every((token) => /^[A-Za-z][A-Za-z'’.\-]*$/.test(token));
}

export function isClientPersonLabel(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  if (isFounderIdentityName(name)) return false;
  if (isStudioOrVendorLabel(name)) return false;
  if (isVendorOrganizationLabel(name)) return false;
  if (isPlatformOrSystemName(name)) return false;
  return looksLikeHumanPersonName(name);
}

export const TODAY_COMMUNICATION_CLASSES = [
  "client",
  "vendor",
  "platform",
  "founder",
  "unknown",
] as const;

export type TodayCommunicationClass = (typeof TODAY_COMMUNICATION_CLASSES)[number];

export type TodayIdentitySignal = {
  displayName: string;
  roles?: readonly string[] | null;
  organizationName?: string | null;
};

const PLATFORM_CONTENT =
  /\b(unsubscribe|manage preferences|view in browser|security alert|password reset|sign[- ]in alert|magic link|product (?:update|news)|changelog|release notes|weekly digest|what's new)\b/i;

export const FOOTER_TEMPLATE_NOISE =
  /\b(unsubscribe|manage (?:email )?preferences|view (?:in browser|as (?:a )?webpage)|privacy policy|email subscriptions?|update your (?:email )?subscriptions?|opt[- ]out|manage (?:your )?subscription)\b/i;

const OPERATIONAL_SYSTEM_ACTION =
  /\b(?:check[- ]?in(?:\s+for(?:\s+your)?\s+flight)?|boarding (?:pass|time)|gate change|appointment reminder|pickup (?:by|window|reminder)|reservation reminder)\b/i;

const GENERATED_OPERATING_BRIEF_RULE = "generated_founder_operating_brief";
const GENERATED_OPERATING_BRIEF_SUBJECT =
  /^(?:(?:re|fw|fwd):\s*)*hourglass morning brief\b/i;
const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;

export function isGeneratedFounderOperatingBriefSubject(
  subject: string | null | undefined,
): boolean {
  const stripped = collapseIdentityText(subject ?? "");
  return stripped.length > 0 && GENERATED_OPERATING_BRIEF_SUBJECT.test(stripped);
}

function normalizedEmailHash(value: string | null | undefined): string | null {
  const hash = value?.trim().toLowerCase() ?? "";
  return EMAIL_HASH_RE.test(hash) ? hash : null;
}

export function collectTodayFounderEmailHashes(
  knownPeople?: readonly TodayKnownPerson[],
): string[] {
  const hashes: string[] = [];
  const seen = new Set<string>();
  for (const person of knownPeople ?? []) {
    if (!isFounderIdentityName(person.displayName)) continue;
    const hash = normalizedEmailHash(person.emailHash);
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

export function collectTodayEmailHashes(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): string[] {
  const hashes: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | null | undefined) => {
    const hash = normalizedEmailHash(value);
    if (!hash || seen.has(hash)) return;
    seen.add(hash);
    hashes.push(hash);
  };
  for (const row of input.candidates ?? []) {
    if (hasRule(row, GENERATED_OPERATING_BRIEF_RULE)) continue;
    const payload = payloadOf(row);
    if (payload.kind === "person_association") add(payload.emailHash);
  }
  add(hashStoredPersonEmail(input.thread?.fromEmail ?? null));
  const messages = input.thread?.messages ?? [];
  const inbound = messages.filter((row) => row.direction === "inbound");
  const unknown = messages.filter((row) => row.direction === "unknown");
  for (const message of inbound) add(message.fromEmailHash);
  if (inbound.length === 0) {
    for (const message of unknown) add(message.fromEmailHash);
  }
  return hashes;
}

export function resolveUniqueKnownPerson(input: {
  emailHashes: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
}): TodayKnownPerson | "ambiguous" | null {
  const wanted = [
    ...new Set(
      input.emailHashes
        .map((row) => normalizedEmailHash(row))
        .filter((row): row is string => Boolean(row)),
    ),
  ];
  if (wanted.length === 0) return null;
  const people = input.knownPeople ?? [];
  const hits: TodayKnownPerson[] = [];
  const seenPerson = new Set<string>();
  for (const hash of wanted) {
    const matches = people.filter(
      (person) => normalizedEmailHash(person.emailHash) === hash,
    );
    const uniqueIds = [...new Set(matches.map((person) => person.personId.trim()))].filter(
      Boolean,
    );
    if (uniqueIds.length > 1) return "ambiguous";
    const person = matches[0];
    if (!person || uniqueIds.length !== 1) continue;
    if (seenPerson.has(person.personId)) continue;
    seenPerson.add(person.personId);
    hits.push(person);
  }
  if (hits.length === 0) return null;
  if (hits.length > 1) return "ambiguous";
  return hits[0]!;
}

function isInternalGeneratedFrom(thread?: TodayGmailThreadContext | null): boolean {
  if (isFounderIdentityName(thread?.fromDisplayName)) return true;
  if (isStudioOrVendorLabel(thread?.fromDisplayName)) return true;
  if (isPlatformOrSystemName(thread?.fromDisplayName)) return true;
  const domain = emailDomain(thread?.fromEmail ?? null);
  if (domain && isStudioMailboxDomain(domain)) return true;
  return false;
}

export function isGeneratedTodayNoise(input: {
  candidates: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
  knownPeople?: readonly TodayKnownPerson[];
}): boolean {
  const generated = input.candidates.filter((row) =>
    hasRule(row, GENERATED_OPERATING_BRIEF_RULE),
  );
  const externalObligation = input.candidates.some((row) => {
    if (hasRule(row, GENERATED_OPERATING_BRIEF_RULE)) return false;
    return row.candidateType !== "person_association";
  });
  if (generated.length > 0 && !externalObligation) return true;
  if (generated.length > 0) return false;
  if (!isGeneratedFounderOperatingBriefSubject(input.thread?.subject ?? null)) {
    return false;
  }
  const hashes = collectTodayEmailHashes(input);
  const known = resolveUniqueKnownPerson({
    emailHashes: hashes,
    knownPeople: input.knownPeople,
  });
  if (known) return false;
  if (isInternalGeneratedFrom(input.thread)) return true;
  if (input.thread?.liveIdentityLoaded === true) {
    const from =
      input.thread.fromEmail?.trim() || input.thread.fromDisplayName?.trim() || "";
    return from.length === 0;
  }
  return !input.thread?.fromEmail?.trim() && hashes.length === 0;
}

const ACTIONABLE_SYSTEM_MAIL =
  /\b(failed payment|payment failed|payment declined|account (?:is )?compromis|security (?:alert|warning|notice)|unauthorized(?:ly)?|suspicious sign[- ]in|deployment failed|service outage|major outage|shipment exception|undeliverable package)\b/i;
const NEWSLETTER_LOCAL_PART =
  /^(welcome|hello|hi|news|newsletter|noreply|no-reply|no_reply|donotreply|do-not-reply|notifications?|notify|mailer|updates?|digest|info|marketing|product|team)$/i;
const SUPPLIER_OR_SYSTEM_LOCAL =
  /^(supply|orders?|billing|accounts|catalog|vendor|wholesale|sales|support|helpdesk|noreply|no-reply|no_reply|donotreply|do-not-reply|notifications?|mailer)$/i;

export function isSupplierOrSystemMailbox(email: string | null | undefined): boolean {
  const local = emailLocalPart(email);
  if (!local) return false;
  if (SUPPLIER_OR_SYSTEM_LOCAL.test(local)) return true;
  if (NEWSLETTER_LOCAL_PART.test(local)) return true;
  return isPlatformOrSystemName(local);
}
const NEWSLETTER_SUBJECT =
  /\b(?:what'?s new|product (?:update|news)|release notes|changelog|weekly digest|monthly (?:update|digest)|newsletter)\b/i;
const NEWSLETTER_PERIODICAL_SUBJECT =
  /\bupdate\b.+\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b.+\bupdate\b/i;
const BULK_GMAIL_LABELS = new Set(["CATEGORY_UPDATES", "CATEGORY_PROMOTIONS"]);

function emailLocalPart(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  const at = trimmed.indexOf("@");
  if (at <= 0) return null;
  return trimmed.slice(0, at);
}

function threadLabelIds(thread?: TodayGmailThreadContext | null): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const message of thread?.messages ?? []) {
    for (const label of message.labelIds ?? []) {
      const value = label.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      ids.push(value);
    }
  }
  return ids;
}

function systemMailHaystack(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): string {
  return [
    input.thread?.subject ?? "",
    input.thread?.fromDisplayName ?? "",
    input.thread?.fromEmail ?? "",
    ...(input.candidates ?? []).map((row) => candidateHaystack(row)),
  ]
    .join("\n")
    .trim();
}

export function isActionableSystemAlert(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): boolean {
  return ACTIONABLE_SYSTEM_MAIL.test(systemMailHaystack(input));
}

export function isFooterOrTemplateNoise(text: string | null | undefined): boolean {
  return FOOTER_TEMPLATE_NOISE.test(text ?? "");
}

export function stripFooterTemplateNoise(text: string): string {
  return text
    .split(/\n+/)
    .filter((line) => !isFooterOrTemplateNoise(line))
    .join("\n")
    .replace(FOOTER_TEMPLATE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const OPERATIONAL_EVENT_DATE =
  /\b(?:(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*,?\s*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*((?:19|20)\d{2}))?\b/i;

function operationalHaystack(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): string {
  return stripFooterTemplateNoise(systemMailHaystack(input));
}

export function isOperationalSystemMail(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): boolean {
  if (isActionableSystemAlert(input)) return false;
  const hay = operationalHaystack(input);
  const subject = input.thread?.subject ?? "";
  if (!OPERATIONAL_SYSTEM_ACTION.test(hay) && !OPERATIONAL_SYSTEM_ACTION.test(subject)) {
    return false;
  }
  const labels = threadLabelIds(input.thread);
  const bulkLabel = labels.some((label) => BULK_GMAIL_LABELS.has(label));
  const platformSender =
    isPlatformOrSystemName(input.thread?.fromDisplayName) ||
    isPlatformOrSystemName(emailLocalPart(input.thread?.fromEmail ?? null));
  return bulkLabel || platformSender || OPERATIONAL_SYSTEM_ACTION.test(subject);
}

export function operationalSystemEventDate(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): string | null {
  const hay = operationalHaystack(input);
  const subject = stripFooterTemplateNoise(input.thread?.subject ?? "");
  const sentAt =
    input.thread?.messages
      ?.map((row) => row.sentAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ??
    input.candidates?.map((row) => row.sourceTimestamp).sort()[0] ??
    null;
  const sentDate = sentAt ? civilDateInZone(sentAt) : null;
  const yearFallback = sentDate ? Number(sentDate.slice(0, 4)) : null;
  const match = OPERATIONAL_EVENT_DATE.exec(`${subject}\n${hay}`);
  if (!match) return null;
  const month = MONTH_NAME_TO_NUMBER[match[1]!.toLowerCase()] ?? null;
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : yearFallback;
  if (!month || !Number.isInteger(day) || !year) return null;
  return dateOnlyFromParts(year, month, day);
}

function operationalGraceDays(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
}): number {
  const hay = `${input.thread?.subject ?? ""}\n${operationalHaystack(input)}`;
  if (/\bcheck[- ]?in\b/i.test(hay)) return 2;
  return 1;
}

export function isExpiredOperationalSystemMail(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
  nowIso?: string;
}): boolean {
  if (!isOperationalSystemMail(input)) return false;
  const nowIso = input.nowIso?.trim();
  if (!nowIso) return false;
  const eventDate = operationalSystemEventDate(input);
  if (eventDate) return isPastDueDate(eventDate, nowIso);
  const sentAt =
    input.thread?.messages
      ?.map((row) => row.sentAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ??
    input.candidates?.map((row) => row.sourceTimestamp).sort()[0] ??
    null;
  const sentDate = sentAt ? civilDateInZone(sentAt) : null;
  if (!sentDate) return false;
  const expiry = addCalendarDays(sentDate, operationalGraceDays(input));
  return expiry ? isPastDueDate(expiry, nowIso) : false;
}

export function isCurrentOperationalSystemMail(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
  nowIso?: string;
}): boolean {
  if (!isOperationalSystemMail(input)) return false;
  return !isExpiredOperationalSystemMail(input);
}

export function isNonActionableSystemMail(input: {
  candidates?: readonly ContinuumCandidate[];
  thread?: TodayGmailThreadContext | null;
  nowIso?: string;
}): boolean {
  if (isActionableSystemAlert(input)) return false;
  if (isCurrentOperationalSystemMail(input)) return false;
  if (isExpiredOperationalSystemMail(input)) return true;
  if (
    isSupplierOrSystemMailbox(input.thread?.fromEmail) &&
    !isActionableSystemAlert(input) &&
    !isCurrentOperationalSystemMail(input)
  ) {
    return true;
  }
  const hay = systemMailHaystack(input);
  if (
    isPromotionalSenderInfrastructure({
      fromEmail: input.thread?.fromEmail,
      fromDisplayName: input.thread?.fromDisplayName,
      haystack: hay,
    })
  ) {
    return true;
  }
  const subject = input.thread?.subject ?? "";
  const labels = threadLabelIds(input.thread);
  const bulkLabel = labels.some((label) => BULK_GMAIL_LABELS.has(label));
  const local = emailLocalPart(input.thread?.fromEmail ?? null);
  const newsletterSender =
    NEWSLETTER_LOCAL_PART.test(local ?? "") ||
    isPlatformOrSystemName(input.thread?.fromDisplayName) ||
    isPlatformOrSystemName(local);
  const newsletterSubject =
    NEWSLETTER_SUBJECT.test(subject) || NEWSLETTER_PERIODICAL_SUBJECT.test(subject);
  const platformContent = PLATFORM_CONTENT.test(hay);
  if (bulkLabel && (newsletterSender || newsletterSubject || platformContent)) {
    return true;
  }
  if (newsletterSender && (newsletterSubject || platformContent || bulkLabel)) {
    return true;
  }
  if (newsletterSubject && (newsletterSender || bulkLabel || platformContent)) {
    return true;
  }
  if (
    platformContent &&
    !input.candidates?.some((row) => hasCommercialPayload(row) && !isPlatformSystemEvidence(row))
  ) {
    return Boolean(newsletterSender || bulkLabel || isPlatformOrSystemName(input.thread?.fromDisplayName));
  }
  return false;
}

const NO_REPLY_INSTRUCTION =
  /\b(?:please\s+)?do not reply(?:\s+(?:directly\s+)?to this (?:email|message|thread))?|\bno[- ]reply\b|\bthis (?:is an? )?(?:automated|automatic) (?:message|email|notification)\b/i;
const WELCOME_OR_TRANSACTIONAL_SUBJECT =
  /^(?:(?:re|fw|fwd):\s*)?(?:welcome(?:\s+to\b)?|your (?:account|order|receipt|invoice)|password (?:reset|changed)|verify your (?:email|account))\b/i;

export function isTransactionalNoReplyMail(input: {
  subject?: string | null;
  fromEmail?: string | null;
  fromDisplayName?: string | null;
  texts?: readonly (string | null | undefined)[];
}): boolean {
  const hay = [input.subject, input.fromDisplayName, ...(input.texts ?? [])]
    .filter((row): row is string => Boolean(row && row.trim()))
    .join("\n");
  if (NO_REPLY_INSTRUCTION.test(hay)) return true;
  if (WELCOME_OR_TRANSACTIONAL_SUBJECT.test(input.subject ?? "") && isSupplierOrSystemMailbox(input.fromEmail)) {
    return true;
  }
  return false;
}

const VENDOR_RULES = new Set([
  "explicit_vendor_waiting",
  "explicit_vendor_commitment",
  "explicit_shop_blocker",
  "vendor_shop_update",
]);

const NAKED_SPEC_SNIPPET =
  /^(?:\d+\s+)?(?:marquise|oval|round|emerald|pear|cushion|princess|radiant|prong|prongs)$/i;

export function isNakedDateText(text: string | null | undefined): boolean {
  const trimmed = text?.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "") ?? "";
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  return /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?$/i.test(
    trimmed,
  );
}

export function isNakedContextSnippet(text: string | null | undefined): boolean {
  const trimmed = text?.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "") ?? "";
  if (!trimmed) return false;
  if (isNakedDateText(trimmed)) return true;
  return NAKED_SPEC_SNIPPET.test(trimmed);
}

const GENERIC_IMAGE_FILENAME =
  /^(?:image\d*|img[-_]?\d*|unnamed|untitled|photo|picture|inline[-_]?image|attachment)(?:[-_.\s]?\d*)?\.(?:jpe?g|png|gif|webp|bmp|tiff?|svg|heic)$/i;
const SOLE_ATTACHMENT_FILENAME =
  /^(?:[\w.-]+\.(?:jpe?g|png|gif|webp|bmp|tiff?|svg|heic|pdf|ai|psd|stl|zip|docx?|xlsx?))$/i;
const MIME_OR_CID_ARTIFACT =
  /^(?:cid:|<cid:|content-id:|image\/(?:jpeg|png|gif|webp)|[0-9a-f]{8,}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpe?g|png))$/i;
const QUOTED_HEADER_DATE =
  /^on\s+(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?,?\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+at\b.*)?$/i;
const SIGNATURE_ONLY =
  /^(?:best regards|kind regards|warm regards|best|regards|sincerely|thanks|thank you|cheers|sent from my (?:iphone|ipad|android)|employee photo|staff photo|company logo)$/i;
const PHONE_OR_ADDRESS_ONLY =
  /^(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$|^\d{3,5}\s+\w+(?:\s+\w+){0,3}\s+(?:st|street|ave|avenue|rd|road|blvd|ln|lane|dr|drive)\.?$/i;
const TODAY_ACTION_VERB =
  /\b(?:send|review|reply|respond|confirm|approve|check(?:-?in)?|pick up|call|email|follow up|schedule|pay|book|verify|update|share|ask|handle|create|finish|deliver|ship|order|choose|look(?:\s+at)?|let .+ know|identify who|do this now)\b/i;

function foldTodayActionText(text: string | null | undefined): string {
  return text?.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "") ?? "";
}

export function isNoiseOnlyCandidateText(text: string | null | undefined): boolean {
  const trimmed = foldTodayActionText(text);
  if (!trimmed) return true;
  const withoutTopic = trimmed.replace(/^(?:attachment_filename|date|note|project_context)\s+/i, "").trim();
  const candidate = withoutTopic || trimmed;
  if (isNakedDateText(candidate) || isNakedDateText(trimmed)) return true;
  if (isNakedContextSnippet(candidate)) return true;
  if (isFooterOrTemplateNoise(candidate) || isFooterOrTemplateNoise(trimmed)) return true;
  if (QUOTED_HEADER_DATE.test(candidate)) return true;
  if (GENERIC_IMAGE_FILENAME.test(candidate)) return true;
  if (SOLE_ATTACHMENT_FILENAME.test(candidate)) return true;
  if (MIME_OR_CID_ARTIFACT.test(candidate)) return true;
  if (SIGNATURE_ONLY.test(candidate)) return true;
  if (PHONE_OR_ADDRESS_ONLY.test(candidate)) return true;
  return false;
}

export function isMeaningfulTodayActionText(text: string | null | undefined): boolean {
  const trimmed = foldTodayActionText(text);
  if (!trimmed) return false;
  if (isNoiseOnlyCandidateText(trimmed)) return false;
  if (TODAY_ACTION_VERB.test(trimmed) || /\?/.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter((word) => /[a-zA-Z]{3,}/.test(word));
  return words.length >= 4;
}

export function candidateActionText(row: ContinuumCandidate): string {
  const payload = payloadOf(row);
  if (payload.kind === "project_context") return payload.value;
  if (payload.kind === "date") return payload.raw;
  if (payload.kind === "follow_up" || payload.kind === "note") return payload.text;
  if (payload.kind === "open_job") return payload.subject;
  return row.evidenceBasis.matchedText ?? candidateText(row);
}

export function isNoiseOnlyCandidate(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "project_context" && payload.topic === "attachment_filename") {
    return !dateHasActionableObligation(row) && !isMeaningfulTodayActionText(payload.value);
  }
  const texts = [candidateActionText(row), row.evidenceBasis.matchedText ?? ""];
  const hasMeaningful = texts.some((text) => isMeaningfulTodayActionText(text));
  if (hasMeaningful) return false;
  if (payload.kind === "date") return !dateHasActionableObligation(row);
  return texts.some((text) => text && isNoiseOnlyCandidateText(text));
}

export type TodayActionabilityInput = {
  currentFounderObligation: boolean;
  trustworthySource: boolean;
  actionText: string | null | undefined;
  hasMeaningfulEvidence?: boolean;
  noFounderAction?: boolean;
  staleInboundSatisfied?: boolean;
  expired?: boolean;
  noiseOnly?: boolean;
};

export function isActionableToday(input: TodayActionabilityInput): boolean {
  if (input.expired) return false;
  if (input.noiseOnly) return false;
  if (input.noFounderAction) return false;
  if (input.staleInboundSatisfied) return false;
  if (!input.trustworthySource) return false;
  if (!input.currentFounderObligation) return false;
  return input.hasMeaningfulEvidence === true || isMeaningfulTodayActionText(input.actionText);
}

export function gmailThreadByMessageId(
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!threadContext) return map;
  for (const [threadId, thread] of threadContext) {
    for (const message of thread.messages ?? []) {
      const messageId = message.messageId?.trim() ?? "";
      if (messageId && !map.has(messageId)) map.set(messageId, threadId);
    }
  }
  return map;
}

export function recoveredGmailThreadId(
  row: ContinuumCandidate,
  threadByMessageId?: ReadonlyMap<string, string> | null,
): string | null {
  const ids = exactGmailIdsFromCandidate(row);
  if (ids.threadIds[0]) return ids.threadIds[0]!;
  for (const messageId of ids.messageIds) {
    const mapped = threadByMessageId?.get(messageId);
    if (mapped) return mapped;
  }
  return sourceThreadId(row);
}

export function hasTrustworthyTodaySource(
  rows: readonly ContinuumCandidate[],
  threadByMessageId?: ReadonlyMap<string, string> | null,
): boolean {
  if (rows.some((row) => row.sourceSystem !== "gmail")) return true;
  return rows.some((row) => Boolean(recoveredGmailThreadId(row, threadByMessageId)));
}

export function collapseTodayCandidateGroups(
  groups: Map<string, ContinuumCandidate[]>,
  threadByMessageId?: ReadonlyMap<string, string> | null,
): Map<string, ContinuumCandidate[]> {
  const entries = [...groups.entries()].map(([key, rows]) => {
    const threads = new Set<string>();
    if (key.startsWith("thread:")) threads.add(key.slice("thread:".length));
    for (const row of rows) {
      const threadId = recoveredGmailThreadId(row, threadByMessageId);
      if (threadId) threads.add(threadId);
    }
    return { key, rows, threads: [...threads] };
  });
  const parent = entries.map((_, index) => index);
  const find = (index: number): number => {
    const current = parent[index]!;
    if (current === index) return index;
    parent[index] = find(current);
    return parent[index]!;
  };
  const byThread = new Map<string, number>();
  for (let index = 0; index < entries.length; index++) {
    for (const threadId of entries[index]!.threads) {
      const prior = byThread.get(threadId);
      if (prior == null) {
        byThread.set(threadId, index);
        continue;
      }
      const left = find(prior);
      const right = find(index);
      if (left !== right) parent[right] = left;
    }
  }
  const rankKey = (key: string): number => {
    if (key.startsWith("project:")) return 0;
    if (key.startsWith("thread:")) return 1;
    return 2;
  };
  const mergedRows = new Map<number, ContinuumCandidate[]>();
  const mergedKey = new Map<number, string>();
  for (let index = 0; index < entries.length; index++) {
    const root = find(index);
    const entry = entries[index]!;
    const list = mergedRows.get(root) ?? [];
    list.push(...entry.rows);
    mergedRows.set(root, list);
    const current = mergedKey.get(root);
    if (!current || rankKey(entry.key) < rankKey(current)) mergedKey.set(root, entry.key);
  }
  const out = new Map<string, ContinuumCandidate[]>();
  for (const [root, rows] of mergedRows) {
    const key = mergedKey.get(root)!;
    const existing = out.get(key) ?? [];
    const seen = new Set(existing.map((row) => row.candidateId));
    for (const row of rows) {
      if (seen.has(row.candidateId)) continue;
      seen.add(row.candidateId);
      existing.push(row);
    }
    out.set(key, existing);
  }
  return out;
}

export function confirmedPersonId(row: ContinuumCandidate): string | null {
  const edited = row.founderEditedTarget;
  if (edited?.kind === "person" && edited.personId) return edited.personId;
  const target = row.proposedTarget;
  if (target.kind !== "person" || !target.personId) return null;
  if (row.reviewStatus === "approved") return target.personId;
  if (row.confidence === "high") return target.personId;
  return null;
}

const STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
]);

function evidenceTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

export function candidateProjectId(row: ContinuumCandidate): string | null {
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "project" || target.kind === "project_spec") {
    return target.projectId;
  }
  if (target.kind === "open_job") return target.projectId;
  return null;
}

export function candidateText(row: ContinuumCandidate): string {
  const payload = row.founderEditedPayload ?? row.payload;
  if (payload.kind === "follow_up") return payload.text;
  if (payload.kind === "note") return payload.text;
  if (payload.kind === "open_job") {
    return `${payload.subject} ${payload.detail ?? ""}`;
  }
  if (payload.kind === "project_context") {
    return `${payload.topic} ${payload.value}`;
  }
  if (payload.kind === "date") return payload.raw;
  return row.evidenceBasis.matchedText ?? "";
}

function candidateHaystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
}

function isUsableEvidence(row: ContinuumCandidate): boolean {
  if (row.candidateState === "superseded") return false;
  if (row.reviewStatus === "discarded") return false;
  return true;
}

export const DECISION_SCORE = 75;
export const SIGNAL_SCORE = 40;
export const CRITICAL_SCORE = 88;

const FUNCTION_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
  "her",
  "they",
  "them",
  "i'll",
  "ill",
  "we'll",
  "well",
  "can",
  "do",
  "did",
  "just",
  "directly",
  "someone",
  "anyone",
  "between",
  "ensure",
]);

const CHANNEL_META = new Set([
  "reply",
  "replied",
  "email",
  "emails",
  "message",
  "messages",
  "inbox",
  "thread",
  "subject",
  "unsubscribe",
  "notification",
  "notifications",
  "mailbox",
  "newsletter",
  "signature",
  "mailto",
  "noreply",
  "subscriptions",
  "subscription",
  "preferences",
  "privacy",
]);

const VALEDICTION = new Set([
  "regards",
  "sincerely",
  "thanks",
  "thank",
  "best",
  "cheers",
  "warmly",
  "cordially",
]);

const OPERATIONAL = new Set([
  "technician",
  "arrive",
  "arrival",
  "site",
  "access",
  "installation",
  "window",
  "appointment",
  "on-site",
  "onsite",
]);

const COMMERCIAL = new Set([
  "cad",
  "render",
  "revision",
  "quote",
  "wax",
  "tracking",
  "metal",
  "gold",
  "platinum",
  "palladium",
  "diamond",
  "diamonds",
  "stone",
  "center",
  "ring",
  "rings",
  "earring",
  "earrings",
  "necklace",
  "pendant",
  "bracelet",
  "size",
  "spec",
  "specs",
  "approval",
  "approved",
  "invoice",
  "payment",
  "deposit",
  "project",
  "design",
  "setting",
  "prong",
  "pave",
  "band",
  "engagement",
  "marquise",
  "oval",
  "round",
  "emerald",
  "sapphire",
  "file",
  "files",
]);

const COMMITMENT_RULES = new Set([
  "explicit_founder_commitment",
  "explicit_client_request",
  "explicit_vendor_waiting",
  "explicit_vendor_commitment",
  "explicit_follow_up",
]);

const BLOCKED_RULES = new Set([
  "lifecycle",
  "unread",
  "email_age",
]);

function tokensOf(text: string): string[] {
  return evidenceTokens(text);
}

export function payloadOf(row: ContinuumCandidate) {
  return row.founderEditedPayload ?? row.payload;
}

function ruleIdsOf(row: ContinuumCandidate): readonly string[] {
  return row.evidenceBasis.ruleIds;
}

export function hasRule(row: ContinuumCandidate, id: string): boolean {
  return ruleIdsOf(row).includes(id);
}

export function hasVendorRule(row: ContinuumCandidate): boolean {
  return ruleIdsOf(row).some((id) => VENDOR_RULES.has(id));
}

export function isPlatformSystemEvidence(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "person_association" && isPlatformOrSystemName(payload.displayName)) {
    return true;
  }
  const hay = candidateHaystack(row);
  if (!PLATFORM_CONTENT.test(hay)) return false;
  return !hasCommercialPayload(row);
}

export function classifyTodayCommunication(input: {
  candidates: readonly ContinuumCandidate[];
  people?: readonly TodayIdentitySignal[];
  thread?: TodayGmailThreadContext | null;
  vendorDirectory?: readonly string[];
  evidenceTexts?: readonly string[];
  knownPeople?: readonly TodayKnownPerson[];
  nowIso?: string;
}): TodayCommunicationClass {
  if (
    isGeneratedTodayNoise({
      candidates: input.candidates,
      thread: input.thread,
      knownPeople: input.knownPeople,
    })
  ) {
    return "platform";
  }
  if (
    isNonActionableSystemMail({
      candidates: input.candidates,
      thread: input.thread,
      nowIso: input.nowIso,
    }) ||
    isOperationalSystemMail({
      candidates: input.candidates,
      thread: input.thread,
    })
  ) {
    return "platform";
  }
  const names: TodayIdentitySignal[] = [...(input.people ?? [])];
  for (const row of input.candidates) {
    const payload = payloadOf(row);
    if (payload.kind === "person_association" && payload.displayName) {
      names.push({
        displayName: payload.displayName,
        roles: null,
      });
    }
  }
  const hay = input.candidates.map((row) => candidateHaystack(row)).join("\n");
  const storedClient = names.some(
    (person) =>
      (person.roles ?? []).includes("client") &&
      isClientPersonLabel(person.displayName) &&
      !isVendorPerson(person),
  );
  const pendingHumanClient = names.some(
    (person) => isClientPersonLabel(person.displayName) && !isVendorPerson(person),
  );
  const vendorFromSubject = input.candidates.some((row) => {
    const payload = payloadOf(row);
    if (payload.kind !== "project_context") return false;
    return vendorOrganizationFromIdentityText(payload.value) != null;
  });
  const vendorFromGmail =
    vendorOrganizationFromGmailContext({
      thread: input.thread,
      vendorDirectory: input.vendorDirectory,
      evidenceTexts: input.evidenceTexts,
    }) != null;
  const vendorOnThread =
    input.candidates.some((row) => {
      const payload = payloadOf(row);
      if (payload.kind !== "person_association" || !payload.displayName) return false;
      return isVendorPerson({ displayName: payload.displayName, roles: null });
    }) ||
    input.candidates.some((row) => hasVendorRule(row)) ||
    vendorFromSubject ||
    vendorFromGmail;
  const platformName =
    names.some((person) => isPlatformOrSystemName(person.displayName)) ||
    isPlatformOrSystemName(input.thread?.fromDisplayName) ||
    isPlatformOrSystemName(emailLocalPart(input.thread?.fromEmail ?? null));
  const platformContent = PLATFORM_CONTENT.test(hay);
  const commercial = input.candidates.some((row) => hasCommercialPayload(row));
  if (vendorOnThread && !storedClient) return "vendor";
  if (storedClient || (pendingHumanClient && !vendorOnThread)) return "client";
  if (isActionableSystemAlert(input)) return "platform";
  if (platformName || (platformContent && !commercial)) return "platform";
  if (vendorOnThread) return "vendor";
  if (names.some((person) => isFounderIdentityName(person.displayName))) return "founder";
  if (platformContent) return "platform";
  return "unknown";
}

function contentTokens(text: string): string[] {
  return tokensOf(text).filter((token) => !FUNCTION_WORDS.has(token));
}

function domainHits(tokens: readonly string[], domain: ReadonlySet<string>): number {
  return tokens.filter((token) => domain.has(token)).length;
}

const DATE_OBLIGATION =
  /\b(deadline|travel|needed by|need(?:s)? it by|before (?:the )?(?:trip|wedding|flight)|due|deliver(?:y|ed)? by|ready by|approves? .{0,80} by|(?:will|must|should)\s+\w[\w\s]{0,60}\bby)\b/i;

export function dateHasActionableObligation(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind !== "date") return false;
  const matched = `${row.evidenceBasis.matchedText ?? ""} ${payload.raw}`.trim();
  if (isNakedDateText(payload.raw) && !DATE_OBLIGATION.test(matched)) return false;
  if (isFooterOrTemplateNoise(matched)) return false;
  if (NEWSLETTER_SUBJECT.test(matched) || PLATFORM_CONTENT.test(matched)) {
    if (!DATE_OBLIGATION.test(matched)) return false;
  }
  if (!DATE_OBLIGATION.test(matched)) return false;
  return (
    hasNamedActor(matched) ||
    /\b(need(?:s)?|send|deliver|finish|finish(?:ed)?|ready|approves?)\b/i.test(matched)
  );
}

export function hasCommercialPayload(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "structured_spec") return true;
  if (payload.kind === "project_context") {
    return (
      payload.topic === "new_project" ||
      payload.topic === "client_approval" ||
      payload.topic === "cad_revision" ||
      payload.topic === "design_refinement" ||
      payload.topic === "proposed_spec" ||
      payload.topic === "gift_context" ||
      payload.topic === "design_basis"
    );
  }
  if (payload.kind === "date") return dateHasActionableObligation(row);
  const hay = candidateHaystack(row);
  return domainHits(tokensOf(hay), COMMERCIAL) > 0;
}

function isChannelMetaSpeechAct(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  const tokens = contentTokens(hay);
  if (tokens.length === 0) return false;
  if (hasCommercialPayload(row)) return false;
  const channel = domainHits(tokens, CHANNEL_META);
  return channel > 0 && channel >= Math.ceil(tokens.length * 0.5);
}

function isSignatureLike(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  const tokens = contentTokens(hay);
  if (tokens.length === 0 || tokens.length > 5) return false;
  if (hasCommercialPayload(row)) return false;
  return domainHits(tokens, VALEDICTION) > 0;
}

export function isTechnicianVisit(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  return (
    /\btechnician\b/i.test(hay) &&
    /\b(arrive|arrives|arrival|on-?site|pets?|age of 18)\b/i.test(hay)
  );
}

function isOperationalLogistics(row: ContinuumCandidate): boolean {
  if (isTechnicianVisit(row)) return true;
  if (hasCommercialPayload(row)) return false;
  const tokens = contentTokens(candidateHaystack(row));
  return domainHits(tokens, OPERATIONAL) >= 2;
}

function isCalendarFollowUp(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  return (
    /\bfollow up w\/ /i.test(hay) &&
    /\b(?:mon|tue|wed|thu|fri|sat|sun|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}:\d{2}\s*(?:am|pm))\b/i.test(
      hay,
    )
  );
}

function objectAfterCommitmentVerb(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
  const verbs = new Set(["send", "do", "call", "email", "revise", "update", "make"]);
  const index = raw.findIndex((token) => verbs.has(token) || token === "follow");
  if (index < 0) return contentTokens(text);
  return raw.slice(index + 1).filter((token) => {
    const normalized = token.replace(/'/g, "");
    return normalized.length >= 3 && !FUNCTION_WORDS.has(normalized) && !FUNCTION_WORDS.has(token);
  });
}

function hasNamedActor(text: string): boolean {
  return /(?:^|[.!?]\s+)[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?/.test(text) ||
    /\b(?:with|for|to)\s+[A-Z][a-z]{2,}\b/.test(text);
}

function hasDateSignal(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.dueAt) return true;
  if (payload.kind === "follow_up" && payload.dueAt) return true;
  if (payload.kind === "date") return payload.isoDate != null || payload.role === "deadline";
  const hay = candidateHaystack(row);
  return /\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
    hay,
  );
}

export function commitmentIsComplete(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  const text =
    payload.kind === "open_job"
      ? payload.subject
      : payload.kind === "follow_up"
        ? payload.text
        : candidateText(row);
  const objects = objectAfterCommitmentVerb(text);
  const commercialObject = objects.some((token) => COMMERCIAL.has(token));
  if (hasRule(row, "explicit_follow_up")) {
    return hasNamedActor(text) && (hasDateSignal(row) || commercialObject);
  }
  return commercialObject && objects.length > 0;
}

export function isNewProject(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "project_context" && payload.topic === "new_project";
}

export function isExplicitNewProject(row: ContinuumCandidate): boolean {
  return isNewProject(row) && hasRule(row, EXPLICIT_NEW_PROJECT_RULE);
}

const FOUNDER_OUTBOUND_CONTENT =
  /\b(here is the updated|let me know what you think|i(?:'|’)ll send|i am sending|i(?:'|’)m sending|moving forward|please proceed|just sent)\b/i;

export function isClientDesignAnswer(row: ContinuumCandidate): boolean {
  if (isPlatformSystemEvidence(row)) return false;
  if (hasVendorRule(row)) return false;
  if (FOUNDER_OUTBOUND_CONTENT.test(candidateHaystack(row))) return false;
  const payload = payloadOf(row);
  if (payload.kind !== "project_context") return false;
  return (
    payload.topic === "design_refinement" ||
    payload.topic === "cad_revision" ||
    payload.topic === "proposed_spec"
  );
}

function evidenceAgeMs(row: ContinuumCandidate, ctx: FounderAttentionContext): number | null {
  const then = Date.parse(row.sourceTimestamp);
  const now = Date.parse(ctx.nowIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return now - then;
}

export function isHistoricalRediscovery(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
  windowMs = FOUNDER_ATTENTION_NOVELTY_MS,
): boolean {
  const age = evidenceAgeMs(row, ctx);
  return age != null && age > windowMs;
}

export function isPaymentStateChange(row: ContinuumCandidate): boolean {
  if (hasRule(row, "transactional_customer_notice")) return true;
  const hay = candidateHaystack(row);
  return /\bpayment received\b/i.test(hay) && /\binvoice\b/i.test(hay);
}

export function isApproval(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "project_context" && payload.topic === "client_approval") return true;
  return hasRule(row, "explicit_client_approval");
}

function isDesignChange(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  if (payload.kind === "structured_spec") return true;
  if (payload.kind !== "project_context") return false;
  return (
    payload.topic === "cad_revision" ||
    payload.topic === "design_refinement" ||
    payload.topic === "proposed_spec"
  );
}

export function specConflicts(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "structured_spec" && payload.conflict === true;
}

function expandSpecTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      if (token === "yg") return ["yellow", "gold"];
      if (token === "wg") return ["white", "gold"];
      if (token === "rg") return ["rose", "gold"];
      if (token === "pt") return ["platinum"];
      if (token === "twotone" || token === "two") return [];
      return [token];
    });
}

function isNumericSpecValue(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function specTextCompatible(proposed: string, canonical: string): boolean {
  const left = proposed.trim().toLowerCase();
  const right = canonical.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (isNumericSpecValue(left) && isNumericSpecValue(right)) {
    return Number(left) === Number(right);
  }
  if (isNumericSpecValue(left) || isNumericSpecValue(right)) {
    return false;
  }
  if (right.includes(left) || left.includes(right)) return true;
  const proposedTokens = new Set(expandSpecTokens(proposed).filter((token) => token.length >= 3));
  const canonicalTokens = new Set(expandSpecTokens(canonical));
  if (proposedTokens.size === 0) return false;
  return [...proposedTokens].every((token) => canonicalTokens.has(token));
}

function supplyNotesCompatible(proposed: string, canonical: string): boolean {
  if (specTextCompatible(proposed, canonical)) return true;
  const topics = ["lab", "grown", "mounting", "vlora", "center", "diamond", "dias"] as const;
  const hits = (value: string) =>
    topics.filter((topic) => value.toLowerCase().includes(topic));
  const overlap = hits(proposed).filter((topic) => hits(canonical).includes(topic));
  return overlap.length >= 2;
}

export function specValuesMateriallyDisagree(
  fieldName: string,
  proposed: string,
  canonical: string | null | undefined,
): boolean {
  const current = (canonical ?? "").trim();
  if (!current) return false;
  if (fieldName === "diamond_supply_notes") {
    return !supplyNotesCompatible(proposed, current);
  }
  return !specTextCompatible(proposed, current);
}

function stampedSpecProvenance(
  row: ContinuumCandidate,
): string | null {
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return null;
  return isStructuredSpecSourceProvenance(payload.sourceProvenance)
    ? payload.sourceProvenance
    : null;
}

function isExplicitFingerSizeChallenge(row: ContinuumCandidate): boolean {
  if (hasRule(row, "generated_founder_operating_brief")) return false;
  const hay = candidateHaystack(row);
  if (/\b(?:other ring|attachment|\.jpe?g|\.pdf|image\d{3})\b/i.test(hay)) return false;
  return isPersonBoundFingerSizeText(hay);
}

function specEvidenceCanChallengeCanonical(
  row: ContinuumCandidate,
  fieldName: string,
  canonical: string,
): boolean {
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return true;
  if (fieldName === "cad_job_number" || fieldName === "order_number") {
    if (stampedSpecProvenance(row) !== "EXACT") return false;
    const hay = candidateHaystack(row);
    const proposedRole = classifyIdentifierRole(payload.proposedValue, hay);
    const canonicalRole = classifyIdentifierRole(canonical, hay);
    return proposedRole === canonicalRole;
  }
  if (fieldName === "finger_size") {
    return (
      stampedSpecProvenance(row) === "EXACT" && isExplicitFingerSizeChallenge(row)
    );
  }
  return true;
}

function canonicalSpecFor(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): string | null {
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return null;
  const projectId = candidateProjectId(row);
  const live = projectId ? ctx.specByProject?.get(projectId)?.get(payload.fieldName) : null;
  if (live && live.trim()) return live;
  return payload.currentValue;
}

function projectLifecycleOf(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): string | null {
  const projectId = candidateProjectId(row);
  if (!projectId) return null;
  return ctx.lifecycleByProject?.get(projectId) ?? null;
}

function isProductionLifecycle(stage: string | null | undefined): boolean {
  return todayLifecycleClass(stage) === "production";
}

export function isActionableSpecConflict(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  if (row.candidateState !== "conflict" && !specConflicts(row)) return false;
  const payload = payloadOf(row);
  if (payload.kind !== "structured_spec") return row.candidateState === "conflict";
  const lifecycle = projectLifecycleOf(row, ctx);
  if (isTerminalTodayLifecycle(lifecycle)) return false;
  if (isProductionLifecycle(lifecycle) && isDesignStageSpecField(payload.fieldName)) {
    return false;
  }
  const canonical = canonicalSpecFor(row, ctx);
  if (!specValuesMateriallyDisagree(payload.fieldName, payload.proposedValue, canonical)) {
    return false;
  }
  if (
    canonical &&
    !specEvidenceCanChallengeCanonical(row, payload.fieldName, canonical)
  ) {
    return false;
  }
  return true;
}

export function isSubordinateType(row: ContinuumCandidate): boolean {
  if (specConflicts(row) || row.candidateState === "conflict") return false;
  const payload = payloadOf(row);
  if (
    payload.kind === "project_context" &&
    /(?:cad_job_number|repair_job_id|production_job_id|vendor_order_id|workshop_job_id)$/.test(
      payload.topic,
    )
  ) {
    return true;
  }
  return (
    row.candidateType === "structured_spec" ||
    row.candidateType === "date" ||
    row.candidateType === "person_association" ||
    row.candidateType === "project_association"
  );
}

export function waitingOnFounder(row: ContinuumCandidate): boolean {
  const payload = payloadOf(row);
  return payload.kind === "open_job" && payload.waitingOnActor === "founder";
}

function tokenOverlap(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some((token) => right.has(token));
}

function alreadyRepresentedByJob(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  const projectId = candidateProjectId(row);
  const hay = candidateHaystack(row);
  const tokens = new Set(tokensOf(hay));
  if (tokens.size === 0) return false;
  return ctx.jobs.some((job) => {
    if (!isUnresolvedOpenJobState(job.state)) return false;
    if (projectId && job.projectId !== projectId) return false;
    if (!projectId && !ctx.top5Ids?.has(job.jobId)) return false;
    const jobTokens = tokensOf(job.subject);
    if (!tokenOverlap(jobTokens, tokens)) return false;
    if (ctx.top5Ids?.has(job.jobId)) return true;
    return projectId != null;
  });
}

function confidenceWeight(row: ContinuumCandidate): number {
  if (row.confidence === "high") return 8;
  if (row.confidence === "medium") return 3;
  if (row.confidence === "low") return -6;
  return -10;
}

function sourceWeight(row: ContinuumCandidate): number {
  if (row.sourceSystem === "human-intake" || row.sourceSystem === "plaud") return 12;
  if (row.sourceSystem === "remarkable") return 10;
  if (row.sourceSystem === "gmail") return 6;
  if (row.sourceSystem === "google_calendar") return 2;
  return 0;
}

export function sourceThreadId(row: ContinuumCandidate): string | null {
  return exactGmailIdsFromPointer(row.sourceRef).threadId;
}

export function sourceMessageId(row: ContinuumCandidate): string | null {
  return exactGmailIdsFromPointer(row.sourceRef).messageId;
}

export function candidateGmailThreadIds(
  candidates: readonly ContinuumCandidate[],
): string[] {
  return collectExactGmailIds(candidates).threadIds;
}

export function candidateGmailMessageIds(
  candidates: readonly ContinuumCandidate[],
): string[] {
  return collectExactGmailIds(candidates).messageIds;
}

export function projectByThreadFromCandidates(
  rows: readonly ContinuumCandidate[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const projectId = candidateProjectId(row);
    const threadId = sourceThreadId(row);
    if (projectId && threadId && !map.has(threadId)) map.set(threadId, projectId);
  }
  return map;
}

export function groupingKey(
  row: ContinuumCandidate,
  projectByThread?: ReadonlyMap<string, string>,
  threadByMessageId?: ReadonlyMap<string, string>,
): string {
  const threadId = recoveredGmailThreadId(row, threadByMessageId);
  const projectId =
    candidateProjectId(row) ?? (threadId ? (projectByThread?.get(threadId) ?? null) : null);
  if (projectId) return `project:${projectId}`;
  if (threadId) return `thread:${threadId}`;
  const parts = row.sourceRef.split("|");
  if (parts[0] === "he1" && parts[1]) return `human:${parts[1]}`;
  return `candidate:${row.candidateId}`;
}

export function classifyCandidateAttention(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): FounderAttentionJudgment {
  const factors: FounderAttentionFactorId[] = [];
  let score = 0;

  if (!isUsableEvidence(row)) {
    return { lane: "background", score: 0, factors: ["already_represented"], candidateId: row.candidateId };
  }
  if (ruleIdsOf(row).some((id) => BLOCKED_RULES.has(id))) {
    return { lane: "background", score: 0, factors: ["already_represented"], candidateId: row.candidateId };
  }
  if (isNoiseOnlyCandidate(row) && !waitingOnFounder(row) && !dateHasActionableObligation(row)) {
    return { lane: "background", score: 0, factors: ["subordinate_evidence"], candidateId: row.candidateId };
  }

  const source = sourceWeight(row);
  if (source > 0) {
    factors.push("source_type");
    score += source;
  }

  const confidence = confidenceWeight(row);
  if (confidence !== 0) {
    factors.push("confidence");
    score += confidence;
  }

  if (isTechnicianVisit(row) || isOperationalLogistics(row)) {
    factors.push("operational_logistics");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isChannelMetaSpeechAct(row)) {
    factors.push("channel_meta");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }
  if (isSignatureLike(row) || isCalendarFollowUp(row)) {
    factors.push(isCalendarFollowUp(row) ? "channel_meta" : "signature");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  if (row.candidateState === "conflict" || specConflicts(row)) {
    if (!isActionableSpecConflict(row, ctx)) {
      factors.push("canonical_mismatch", "already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("canonical_mismatch");
    score += 90;
    if (alreadyRepresentedByJob(row, ctx)) factors.push("already_represented");
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (isPaymentStateChange(row)) {
    factors.push("project_state_change", "novelty");
    score += 90;
    return { lane: "signal", score, factors, candidateId: row.candidateId };
  }

  if (isNewProject(row)) {
    if (candidateProjectId(row)) {
      factors.push("already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    if (!isExplicitNewProject(row) || isHistoricalRediscovery(row, ctx)) {
      factors.push(isHistoricalRediscovery(row, ctx) ? "already_represented" : "subordinate_evidence");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("project_state_change", "novelty");
    score += 60;
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }

  if (
    (row.confidence === "low" || row.confidence === "ambiguous") &&
    !isApproval(row) &&
    !isClientDesignAnswer(row)
  ) {
    factors.push("confidence");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  if (isApproval(row)) {
    factors.push("commercial_relevance", "project_state_change");
    score += 70;
    if (alreadyRepresentedByJob(row, ctx) || isHistoricalRediscovery(row, ctx, FOUNDER_ATTENTION_NOVELTY_MS * 2)) {
      factors.push("already_represented");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    return { lane: "signal", score, factors, candidateId: row.candidateId };
  }

  if (ruleIdsOf(row).some((id) => COMMITMENT_RULES.has(id)) || row.candidateType === "open_job") {
    if (!commitmentIsComplete(row)) {
      factors.push("commitment_fragment");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("commitment_complete", "commercial_relevance");
    score += 70;
    if (waitingOnFounder(row)) {
      factors.push("ownership_founder");
      score += 18;
    }
  }

  if (isClientDesignAnswer(row) || isDesignChange(row)) {
    factors.push("commercial_relevance");
    if (isSubordinateType(row)) {
      factors.push("subordinate_evidence");
      return { lane: "background", score, factors, candidateId: row.candidateId };
    }
    score += 70;
  }

  if (row.candidateType === "follow_up") {
    if (!commitmentIsComplete(row)) {
      factors.push("commitment_fragment");
      return { lane: "background", score: 0, factors, candidateId: row.candidateId };
    }
    factors.push("commitment_complete");
    score += 50;
  }

  if (alreadyRepresentedByJob(row, ctx)) {
    factors.push("already_represented");
    return { lane: "background", score: 0, factors, candidateId: row.candidateId };
  }

  const payload = payloadOf(row);
  if (payload.kind === "open_job" && payload.dueAt && isPastDueDate(payload.dueAt, ctx.nowIso)) {
    factors.push("urgency");
    score += 16;
  }

  if (isSubordinateType(row)) {
    factors.push("subordinate_evidence");
    return { lane: "background", score, factors, candidateId: row.candidateId };
  }

  if (score >= DECISION_SCORE && (waitingOnFounder(row) || isClientDesignAnswer(row))) {
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (score >= DECISION_SCORE) {
    return { lane: "decision", score, factors, candidateId: row.candidateId };
  }
  if (score >= SIGNAL_SCORE && hasCommercialPayload(row) && !isHistoricalRediscovery(row, ctx)) {
    return { lane: "signal", score, factors, candidateId: row.candidateId };
  }
  if (score >= SIGNAL_SCORE && waitingOnFounder(row) && commitmentIsComplete(row)) {
    return { lane: "decision", score: Math.max(score, DECISION_SCORE), factors, candidateId: row.candidateId };
  }
  return { lane: "background", score, factors, candidateId: row.candidateId };
}

export function isFounderAttentionWorthy(
  row: ContinuumCandidate,
  ctx: FounderAttentionContext,
): boolean {
  const lane = classifyCandidateAttention(row, ctx).lane;
  return lane === "decision" || lane === "signal";
}

