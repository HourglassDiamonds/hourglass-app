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
  type DigitalCardAdditionalLink,
  type SaveDigitalCardFieldErrors,
  type SaveDigitalCardInput,
  type SaveDigitalCardLinkDraft,
  type SaveDigitalCardValidationCode,
  type ShareContactInput,
  type ShareContactValidationCode,
  type SubmittedContact,
} from "./types";
import {
  parseHttpUrl,
  parseHttpsUrl,
  parseInstagramUrl,
  trimToNull,
} from "./urls";

export { parseHttpUrl, parseHttpsUrl, parseInstagramUrl, trimToNull } from "./urls";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED = new Set<string>(DIGITAL_CARD_RESERVED_SLUGS);

export function isDigitalCardUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
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

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === "0") {
    return false;
  }
  return fallback;
}

const LINK_FIELD = ["link1Label", "link1Url", "link2Label", "link2Url"] as const;

function parseAdditionalLinks(
  raw: SaveDigitalCardInput["additionalLinks"],
): {
  links: DigitalCardAdditionalLink[];
  fieldErrors: SaveDigitalCardFieldErrors;
  code: "too-many-links" | "invalid-link" | null;
} {
  let incoming: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { links: [], fieldErrors: {}, code: null };
    try {
      incoming = JSON.parse(trimmed);
    } catch {
      return {
        links: [],
        fieldErrors: { link1Url: "Check the additional links." },
        code: "invalid-link",
      };
    }
  }
  if (incoming == null) return { links: [], fieldErrors: {}, code: null };
  if (!Array.isArray(incoming)) {
    return {
      links: [],
      fieldErrors: { link1Url: "Check the additional links." },
      code: "invalid-link",
    };
  }
  if (incoming.length > DIGITAL_CARD_MAX_ADDITIONAL_LINKS) {
    return {
      links: [],
      fieldErrors: { link1Url: "You can add up to five additional links." },
      code: "too-many-links",
    };
  }
  const links: DigitalCardAdditionalLink[] = [];
  const fieldErrors: SaveDigitalCardFieldErrors = {};
  incoming.forEach((item, index) => {
    const labelKey = LINK_FIELD[index * 2];
    const urlKey = LINK_FIELD[index * 2 + 1];
    if (!item || typeof item !== "object") {
      if (labelKey && urlKey) {
        fieldErrors[urlKey] = "Check this additional link.";
      }
      return;
    }
    const record = item as SaveDigitalCardLinkDraft;
    const label = trimToNull(typeof record.label === "string" ? record.label : null);
    const urlRaw = typeof record.url === "string" ? record.url : null;
    const urlTrimmed = trimToNull(urlRaw);
    if (!label && !urlTrimmed) return;
    if (label && label.length > DIGITAL_CARD_LINK_LABEL_MAX && labelKey) {
      fieldErrors[labelKey] = "That label is too long.";
    }
    if (!label && urlTrimmed && labelKey) {
      fieldErrors[labelKey] = "Enter a label for this link.";
    }
    const urlResult = parseHttpUrl(urlRaw);
    if (urlTrimmed && (!urlResult.ok || !urlResult.url) && urlKey) {
      fieldErrors[urlKey] = "Enter a valid URL for this link.";
    }
    if (!urlTrimmed && label && urlKey) {
      fieldErrors[urlKey] = "Enter a URL for this link.";
    }
    if (
      label &&
      label.length <= DIGITAL_CARD_LINK_LABEL_MAX &&
      urlResult.ok &&
      urlResult.url &&
      !fieldErrors[labelKey ?? "link1Label"] &&
      !fieldErrors[urlKey ?? "link1Url"]
    ) {
      links.push({ label, url: urlResult.url });
    }
  });
  return {
    links,
    fieldErrors,
    code: Object.keys(fieldErrors).length > 0 ? "invalid-link" : null,
  };
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
  | {
      ok: false;
      code: SaveDigitalCardValidationCode;
      message: string;
      fieldErrors: SaveDigitalCardFieldErrors;
    };

function validationFailure(
  code: SaveDigitalCardValidationCode,
  message: string,
  fieldErrors: SaveDigitalCardFieldErrors,
): ParseDigitalCardFieldsResult {
  return { ok: false, code, message, fieldErrors };
}

export function parseDigitalCardFields(
  input: SaveDigitalCardInput,
): ParseDigitalCardFieldsResult {
  const fieldErrors: SaveDigitalCardFieldErrors = {};
  let code: SaveDigitalCardValidationCode | null = null;
  let message = "Check the highlighted fields.";

  const displayName = trimToNull(input.displayName);
  if (!displayName) {
    fieldErrors.displayName = "Enter a name.";
    code = "missing-name";
    message = "Enter a name.";
  } else if (displayName.length > DIGITAL_CARD_NAME_MAX) {
    fieldErrors.displayName = "That name is too long.";
    code = "oversized-name";
    message = "That name is too long.";
  }

  const memorableTitle = trimToNull(input.memorableTitle);
  const professionalTitle = trimToNull(input.professionalTitle);
  if (memorableTitle && memorableTitle.length > DIGITAL_CARD_TITLE_MAX) {
    fieldErrors.memorableTitle = "That title is too long.";
    code = code ?? "oversized-title";
    message = "That title is too long.";
  }
  if (professionalTitle && professionalTitle.length > DIGITAL_CARD_TITLE_MAX) {
    fieldErrors.professionalTitle = "That title is too long.";
    code = code ?? "oversized-title";
    message = "That title is too long.";
  }

  const company = trimToNull(input.company);
  if (company && company.length > DIGITAL_CARD_COMPANY_MAX) {
    fieldErrors.company = "That company name is too long.";
    code = code ?? "oversized-company";
    message = "That company name is too long.";
  }

  const emailRaw = trimToNull(input.email);
  if (emailRaw && emailRaw.length > DIGITAL_CARD_EMAIL_MAX) {
    fieldErrors.email = "Enter a valid email.";
    code = code ?? "invalid-email";
    message = "Enter a valid email.";
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email && !fieldErrors.email) {
    fieldErrors.email = "Enter a valid email.";
    code = code ?? "invalid-email";
    message = "Enter a valid email.";
  }

  const phoneRaw = trimToNull(input.phone);
  let phone: string | null = null;
  if (phoneRaw) {
    const classified = classifyPhone(phoneRaw);
    if (classified.status !== "us-compatible") {
      fieldErrors.phone = "Enter a valid U.S. phone number.";
      code = code ?? "invalid-phone";
      message = "Enter a valid U.S. phone number.";
    } else {
      phone = classified.normalized;
    }
  }

  const slugRaw = trimToNull(input.slug);
  let slug: string | null = null;
  if (slugRaw) {
    const parsedSlug = parseSlug(slugRaw);
    if (!parsedSlug.ok) {
      fieldErrors.slug = "Use a short lowercase link, like justin-smith.";
      code = code ?? "invalid-slug";
      message = "Use a short lowercase link, like justin-smith.";
    } else {
      slug = parsedSlug.slug;
    }
  }

  const website = parseHttpUrl(input.websiteUrl);
  if (!website.ok) {
    fieldErrors.websiteUrl = "Enter a valid website URL.";
    code = code ?? "invalid-website-url";
    message = "Enter a valid website URL.";
  }

  const linkedin = parseHttpUrl(input.linkedinUrl);
  if (!linkedin.ok) {
    fieldErrors.linkedinUrl = "Enter a valid LinkedIn URL.";
    code = code ?? "invalid-linkedin-url";
    message = "Enter a valid LinkedIn URL.";
  }

  const instagram = parseInstagramUrl(input.instagramUrl);
  if (!instagram.ok) {
    fieldErrors.instagramUrl = "Enter a valid Instagram URL or handle.";
    code = code ?? "invalid-instagram-url";
    message = "Enter a valid Instagram URL or handle.";
  }

  const avatar = parseHttpsUrl(input.avatarUrl);
  if (!avatar.ok) {
    fieldErrors.avatarUrl = "Portrait must use an HTTPS URL.";
    code = code ?? "invalid-portrait-url";
    message = "Portrait must use an HTTPS URL.";
  }

  const links = parseAdditionalLinks(input.additionalLinks);
  Object.assign(fieldErrors, links.fieldErrors);
  if (links.code) {
    code = code ?? links.code;
    message =
      links.code === "too-many-links"
        ? "You can add up to five additional links."
        : "Check the additional links.";
  }

  if (code) {
    return validationFailure(code, message, fieldErrors);
  }

  return {
    ok: true,
    value: {
      slug,
      published: parseBoolean(input.published, true),
      displayName: displayName!,
      memorableTitle,
      professionalTitle,
      company,
      email,
      emailPublic: parseBoolean(input.emailPublic, true),
      phone,
      phonePublic: parseBoolean(input.phonePublic, true),
      websiteUrl: website.ok ? website.url : null,
      linkedinUrl: linkedin.ok ? linkedin.url : null,
      instagramUrl: instagram.ok ? instagram.url : null,
      additionalLinks: links.links,
      avatarUrl: avatar.ok ? avatar.url : null,
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
