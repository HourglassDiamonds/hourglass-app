/**
 * Continuum digital card / identity-exchange contracts.
 * Public card is a curated identity document, not a Person profile dump.
 */

import type { ContinuumId, ContinuumSourceSystem } from "../contracts/types";

export const DIGITAL_CARD_SOURCE_SYSTEM = "continuum-card" as const satisfies ContinuumSourceSystem;
export const DIGITAL_CARD_CREATED_BY = "continuum-card" as const;
export const DIGITAL_CARD_SCHEMA_VERSION = 1 as const;

export const DIGITAL_CARD_EXCHANGE_EVENT_TYPE = "digital_card_exchange" as const;

export const DIGITAL_CARD_SLUG_MIN = 3;
export const DIGITAL_CARD_SLUG_MAX = 48;
export const DIGITAL_CARD_NAME_MAX = 80;
export const DIGITAL_CARD_TITLE_MAX = 80;
export const DIGITAL_CARD_COMPANY_MAX = 120;
export const DIGITAL_CARD_EMAIL_MAX = 254;
export const DIGITAL_CARD_URL_MAX = 2048;
export const DIGITAL_CARD_LINK_LABEL_MAX = 40;
export const DIGITAL_CARD_MAX_ADDITIONAL_LINKS = 5;
export const DIGITAL_CARD_JOB_TITLE_MAX = 80;

export const DIGITAL_CARD_RESERVED_SLUGS = [
  "vcard",
  "new",
  "edit",
  "preview",
  "admin",
  "api",
  "www",
  "continuum",
] as const;

export type DigitalCardAdditionalLink = {
  label: string;
  url: string;
};

export type DigitalCard = {
  id: ContinuumId;
  ownerUsername: string;
  ownerPersonId: ContinuumId | null;
  slug: string;
  published: boolean;
  displayName: string;
  memorableTitle: string | null;
  professionalTitle: string | null;
  company: string | null;
  email: string | null;
  emailPublic: boolean;
  phone: string | null;
  phonePublic: boolean;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  additionalLinks: DigitalCardAdditionalLink[];
  avatarUrl: string | null;
  sourceSystem: typeof DIGITAL_CARD_SOURCE_SYSTEM;
  createdAt: string;
  updatedAt: string;
};

export type DigitalCardContextStatus = "draft" | "active" | "ended";

export const DIGITAL_CARD_CONTEXT_STATUSES = [
  "draft",
  "active",
  "ended",
] as const satisfies readonly DigitalCardContextStatus[];

export type DigitalCardContext = {
  id: ContinuumId;
  cardId: ContinuumId;
  publicToken: string;
  label: string;
  status: DigitalCardContextStatus;
  startedAt: string | null;
  endedAt: string | null;
  sourceSystem: typeof DIGITAL_CARD_SOURCE_SYSTEM;
  createdAt: string;
};

export type IdentityExchangeResolution = "matched" | "created" | "review";

export const IDENTITY_EXCHANGE_RESOLUTIONS = [
  "matched",
  "created",
  "review",
] as const satisfies readonly IdentityExchangeResolution[];

export type SubmittedContact = {
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
};

export type IdentityExchange = {
  id: ContinuumId;
  occurredAt: string;
  cardId: ContinuumId;
  cardSlug: string;
  contextId: ContinuumId | null;
  ownerUsername: string;
  ownerPersonId: ContinuumId | null;
  counterpartyPersonId: ContinuumId | null;
  eventType: typeof DIGITAL_CARD_EXCHANGE_EVENT_TYPE;
  sourceSystem: typeof DIGITAL_CARD_SOURCE_SYSTEM;
  resolutionStatus: IdentityExchangeResolution;
  reasonCode: string;
  submissionId: ContinuumId;
  submittedContact: SubmittedContact;
  createdAt: string;
};

export type PublicDigitalCard = {
  slug: string;
  displayName: string;
  memorableTitle: string | null;
  professionalTitle: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  additionalLinks: DigitalCardAdditionalLink[];
  avatarUrl: string | null;
};

export type SaveDigitalCardLinkDraft = {
  label?: string | null;
  url?: string | null;
};

export type SaveDigitalCardInput = {
  slug?: string | null;
  published?: boolean;
  displayName?: string | null;
  memorableTitle?: string | null;
  professionalTitle?: string | null;
  company?: string | null;
  email?: string | null;
  emailPublic?: boolean;
  phone?: string | null;
  phonePublic?: boolean;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  additionalLinks?: DigitalCardAdditionalLink[] | SaveDigitalCardLinkDraft[] | string | null;
  avatarUrl?: string | null;
};

export type SaveDigitalCardField =
  | "displayName"
  | "memorableTitle"
  | "professionalTitle"
  | "company"
  | "email"
  | "phone"
  | "websiteUrl"
  | "linkedinUrl"
  | "instagramUrl"
  | "avatarUrl"
  | "slug"
  | "published"
  | "emailPublic"
  | "phonePublic"
  | "link1Label"
  | "link1Url"
  | "link2Label"
  | "link2Url";

export type SaveDigitalCardFieldErrors = Partial<Record<SaveDigitalCardField, string>>;

export type SaveDigitalCardValidationCode =
  | "missing-name"
  | "oversized-name"
  | "oversized-title"
  | "oversized-company"
  | "invalid-email"
  | "invalid-phone"
  | "invalid-slug"
  | "slug-taken"
  | "invalid-url"
  | "invalid-website-url"
  | "invalid-linkedin-url"
  | "invalid-instagram-url"
  | "invalid-portrait-url"
  | "too-many-links"
  | "invalid-link";

export type SaveDigitalCardResult =
  | { status: "saved"; card: DigitalCard }
  | {
      status: "validation-error";
      code: SaveDigitalCardValidationCode;
      message: string;
      fieldErrors: SaveDigitalCardFieldErrors;
    }
  | { status: "unauthorized" }
  | { status: "error" };

export type ShareContactInput = {
  submissionId: string;
  slug: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  consent?: boolean;
  contextToken?: string | null;
  honeypot?: string | null;
};

export type ShareContactValidationCode =
  | "missing-name"
  | "oversized-name"
  | "oversized-company"
  | "oversized-title"
  | "invalid-email"
  | "invalid-phone"
  | "consent-required"
  | "invalid-id"
  | "card-not-found";

export type ShareContactResult =
  | {
      status: "accepted";
      resolution: IdentityExchangeResolution;
      exchangeId: string;
    }
  | {
      status: "validation-error";
      code: ShareContactValidationCode;
      message: string;
    }
  | { status: "ignored" }
  | { status: "rate-limited"; retryAfterSeconds: number }
  | { status: "error" };
