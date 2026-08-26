/**
 * Digital card field parsing. Does not write.
 */

import { randomUUID } from "node:crypto";
import { classifyPhone, normalizeEmail } from "@/lib/continuum/client-memory/hashes";
import { splitDisplayName } from "@/lib/continuum/client-memory/classify";
import {
  DIGITAL_CARD_COMPANY_MAX,
  DIGITAL_CARD_EMAIL_MAX,
  DIGITAL_CARD_JOB_TITLE_MAX,
  DIGITAL_CARD_LINK_LABEL_MAX,
  DIGITAL_CARD_MAX_ADDITIONAL_LINKS,
  DIGITAL_CARD_NAME_MAX,
  DIGITAL_CARD_RESERVED_SLUGS,
  DIGITAL_CARD_SLUG_MAX,
  DIGITAL_CARD_SLUG_MIN,
  DIGITAL_CARD_TITLE_MAX,
  DIGITAL_CARD_URL_MAX,
  type DigitalCardAdditionalLink,
  type SaveDigitalCardInput,
  type SaveDigitalCardValidationCode,
  type ShareContactInput,
  type ShareContactValidationCode,
  type SubmittedContact,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED = new Set<string>(DIGITAL_CARD_RESERVED_SLUGS);

export function isDigitalCardUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function suggestSlugFromName(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, DIGITAL_CARD_SLUG_MAX);
  if (slug.length >= DIGITAL_CARD_SLUG_MIN && SLUG_RE.test(slug) && !RESERVED.has(slug)) {
    return slug;
  }
  return "card";
}

export type ParseSlugResult =
  | { ok: true; slug: string }
  | { ok: false; code: "invalid-slug" };

export function isPublicCardSlug(raw: string | null | undefined): boolean {
  return parseSlug(raw).ok;
}

export function parseSlug(raw: string | null | undefined): ParseSlugResult {
  const slug = trimToNull(raw)?.toLowerCase() ?? null;
  if (!slug) return { ok: false, code: "invalid-slug" };
  if (
    slug.length < DIGITAL_CARD_SLUG_MIN ||
    slug.length > DIGITAL_CARD_SLUG_MAX ||
    !SLUG_RE.test(slug) ||
    RESERVED.has(slug)
  ) {
    return { ok: false, code: "invalid-slug" };
  }
  return { ok: true, slug };
}

export function parseHttpUrl(
  raw: string | null | undefined,
  options?: { allowEmpty?: boolean },
): { ok: true; url: string | null } | { ok: false } {
  const value = trimToNull(raw);
  if (!value) {
    return options?.allowEmpty === false ? { ok: false } : { ok: true, url: null };
  }
  if (value.length > DIGITAL_CARD_URL_MAX) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false };
  if (parsed.username || parsed.password) return { ok: false };
  if (!parsed.hostname) return { ok: false };
  return { ok: true, url: parsed.toString() };
}

export function parseInstagramUrl(
  raw: string | null | undefined,
): { ok: true; url: string | null } | { ok: false } {
  const value = trimToNull(raw);
  if (!value) return { ok: true, url: null };
  if (/^https?:\/\//i.test(value)) return parseHttpUrl(value);
  const handle = value.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return { ok: false };
  return { ok: true, url: `https://www.instagram.com/${handle}` };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === "0") {
    return false;
  }
  return fallback;
}

function parseAdditionalLinks(
  raw: SaveDigitalCardInput["additionalLinks"],
):
  | { ok: true; links: DigitalCardAdditionalLink[] }
  | { ok: false; code: "too-many-links" | "invalid-link" } {
  let incoming: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, links: [] };
    try {
      incoming = JSON.parse(trimmed);
    } catch {
      return { ok: false, code: "invalid-link" };
    }
  }
  if (incoming == null) return { ok: true, links: [] };
  if (!Array.isArray(incoming)) return { ok: false, code: "invalid-link" };
  if (incoming.length > DIGITAL_CARD_MAX_ADDITIONAL_LINKS) {
    return { ok: false, code: "too-many-links" };
  }
  const links: DigitalCardAdditionalLink[] = [];
  for (const item of incoming) {
    if (!item || typeof item !== "object") return { ok: false, code: "invalid-link" };
    const record = item as { label?: unknown; url?: unknown };
    const label = trimToNull(typeof record.label === "string" ? record.label : null);
    const urlResult = parseHttpUrl(
      typeof record.url === "string" ? record.url : null,
      { allowEmpty: false },
    );
    if (!label || label.length > DIGITAL_CARD_LINK_LABEL_MAX || !urlResult.ok || !urlResult.url) {
      return { ok: false, code: "invalid-link" };
    }
    links.push({ label, url: urlResult.url });
  }
  return { ok: true, links };
}

export type ParsedDigitalCardFields = {
  slug: string | null;
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
};

export type ParseDigitalCardFieldsResult =
  | { ok: true; value: ParsedDigitalCardFields }
  | { ok: false; code: SaveDigitalCardValidationCode; message: string };

export function parseDigitalCardFields(
  input: SaveDigitalCardInput,
): ParseDigitalCardFieldsResult {
  const displayName = trimToNull(input.displayName);
  if (!displayName) {
    return { ok: false, code: "missing-name", message: "Enter a name." };
  }
  if (displayName.length > DIGITAL_CARD_NAME_MAX) {
    return { ok: false, code: "oversized-name", message: "That name is too long." };
  }

  const memorableTitle = trimToNull(input.memorableTitle);
  const professionalTitle = trimToNull(input.professionalTitle);
  if (
    (memorableTitle && memorableTitle.length > DIGITAL_CARD_TITLE_MAX) ||
    (professionalTitle && professionalTitle.length > DIGITAL_CARD_TITLE_MAX)
  ) {
    return { ok: false, code: "oversized-title", message: "That title is too long." };
  }

  const company = trimToNull(input.company);
  if (company && company.length > DIGITAL_CARD_COMPANY_MAX) {
    return {
      ok: false,
      code: "oversized-company",
      message: "That company name is too long.",
    };
  }

  const emailRaw = trimToNull(input.email);
  if (emailRaw && emailRaw.length > DIGITAL_CARD_EMAIL_MAX) {
    return { ok: false, code: "invalid-email", message: "Enter a valid email." };
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) {
    return { ok: false, code: "invalid-email", message: "Enter a valid email." };
  }

  const phoneRaw = trimToNull(input.phone);
  let phone: string | null = null;
  if (phoneRaw) {
    const classified = classifyPhone(phoneRaw);
    if (classified.status !== "us-compatible") {
      return {
        ok: false,
        code: "invalid-phone",
        message: "Enter a valid U.S. phone number.",
      };
    }
    phone = classified.normalized;
  }

  const slugRaw = trimToNull(input.slug);
  let slug: string | null = null;
  if (slugRaw) {
    const parsedSlug = parseSlug(slugRaw);
    if (!parsedSlug.ok) {
      return {
        ok: false,
        code: "invalid-slug",
        message: "Use a short lowercase link, like justin-smith.",
      };
    }
    slug = parsedSlug.slug;
  }

  const website = parseHttpUrl(input.websiteUrl);
  const linkedin = parseHttpUrl(input.linkedinUrl);
  const instagram = parseInstagramUrl(input.instagramUrl);
  const avatar = parseHttpUrl(input.avatarUrl);
  if (!website.ok || !linkedin.ok || !instagram.ok || !avatar.ok) {
    return { ok: false, code: "invalid-url", message: "Enter a valid web address." };
  }

  const links = parseAdditionalLinks(input.additionalLinks);
  if (!links.ok) {
    return {
      ok: false,
      code: links.code,
      message:
        links.code === "too-many-links"
          ? "You can add up to five additional links."
          : "Check the additional links.",
    };
  }

  return {
    ok: true,
    value: {
      slug,
      published: parseBoolean(input.published, true),
      displayName,
      memorableTitle,
      professionalTitle,
      company,
      email,
      emailPublic: parseBoolean(input.emailPublic, true),
      phone,
      phonePublic: parseBoolean(input.phonePublic, true),
      websiteUrl: website.url,
      linkedinUrl: linkedin.url,
      instagramUrl: instagram.url,
      additionalLinks: links.links,
      avatarUrl: avatar.url,
    },
  };
}

export type ParseShareContactResult =
  | { ok: true; value: SubmittedContact; submissionId: string }
  | { ok: false; code: ShareContactValidationCode; message: string };

export function parseShareContact(input: ShareContactInput): ParseShareContactResult {
  const submissionId = input.submissionId.trim();
  if (!isDigitalCardUuid(submissionId)) {
    return { ok: false, code: "invalid-id", message: "Unable to send your details." };
  }

  if (input.consent !== true) {
    return {
      ok: false,
      code: "consent-required",
      message: "Please confirm you want to share your details.",
    };
  }

  const displayName = trimToNull(input.name);
  if (!displayName) {
    return { ok: false, code: "missing-name", message: "Enter your name." };
  }
  if (displayName.length > DIGITAL_CARD_NAME_MAX) {
    return { ok: false, code: "oversized-name", message: "That name is too long." };
  }

  const company = trimToNull(input.company);
  if (company && company.length > DIGITAL_CARD_COMPANY_MAX) {
    return {
      ok: false,
      code: "oversized-company",
      message: "That company name is too long.",
    };
  }

  const jobTitle = trimToNull(input.jobTitle);
  if (jobTitle && jobTitle.length > DIGITAL_CARD_JOB_TITLE_MAX) {
    return { ok: false, code: "oversized-title", message: "That title is too long." };
  }

  const emailRaw = trimToNull(input.email);
  if (emailRaw && emailRaw.length > DIGITAL_CARD_EMAIL_MAX) {
    return { ok: false, code: "invalid-email", message: "Enter a valid email." };
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) {
    return { ok: false, code: "invalid-email", message: "Enter a valid email." };
  }

  const phoneRaw = trimToNull(input.phone);
  let phone: string | null = null;
  if (phoneRaw) {
    const classified = classifyPhone(phoneRaw);
    if (classified.status !== "us-compatible") {
      return {
        ok: false,
        code: "invalid-phone",
        message: "Enter a valid U.S. phone number.",
      };
    }
    phone = classified.normalized;
  }

  const parts = splitDisplayName(displayName);
  return {
    ok: true,
    submissionId,
    value: {
      displayName,
      givenName: parts.givenName,
      familyName: parts.familyName,
      email,
      phone,
      company,
      jobTitle,
    },
  };
}

export function newDigitalCardId(): string {
  return randomUUID();
}
