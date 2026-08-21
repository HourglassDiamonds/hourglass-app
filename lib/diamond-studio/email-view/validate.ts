import { createHash } from "node:crypto";
import { isValidEmail } from "@/lib/concierge/validation";
import { sanitizeAttributionRecord } from "@/lib/attribution";
import type { AttributionSnapshot } from "@/lib/attribution";
import {
  parseStudioConfigurationObject,
  type DiamondStudioConfiguration,
} from "@/lib/diamond-studio/configuration";
import {
  STUDIO_VIEW_EMAIL_MAX_BODY_BYTES,
  STUDIO_VIEW_EMAIL_MAX_FIRST_NAME,
} from "./types";

const ALLOWED_BODY_KEYS = new Set([
  "email",
  "firstName",
  "company_website",
  "configuration",
  "attribution",
]);

const HEADER_INJECTION = /[\r\n\0]|%0[ad]/i;

export type EmailViewValidation =
  | {
      ok: true;
      email: string;
      firstName?: string;
      honeypot: string;
      configuration: DiamondStudioConfiguration;
      attribution?: AttributionSnapshot;
    }
  | {
      ok: false;
      code:
        | "invalid_email"
        | "unsupported_configuration"
        | "payload_too_large"
        | "invalid_request";
      message: string;
    };

export function hasHeaderInjection(value: string): boolean {
  return HEADER_INJECTION.test(value);
}

export function parseStudioViewRecipientEmail(
  raw: unknown,
): { ok: true; email: string } | { ok: false } {
  if (typeof raw !== "string") return { ok: false };
  if (hasHeaderInjection(raw)) return { ok: false };
  const email = raw.trim().toLowerCase();
  if (!email || email.includes(",") || email.includes(" ")) return { ok: false };
  if (!isValidEmail(email)) return { ok: false };
  return { ok: true, email };
}

export function parseOptionalFirstName(
  raw: unknown,
): { ok: true; firstName?: string } | { ok: false } {
  if (raw == null || raw === "") return { ok: true };
  if (typeof raw !== "string") return { ok: false };
  if (hasHeaderInjection(raw)) return { ok: false };
  const firstName = raw.trim().slice(0, STUDIO_VIEW_EMAIL_MAX_FIRST_NAME);
  if (!firstName) return { ok: true };
  return { ok: true, firstName };
}

export function parseEmailViewJsonBody(
  rawText: string,
): EmailViewValidation {
  if (Buffer.byteLength(rawText, "utf8") > STUDIO_VIEW_EMAIL_MAX_BODY_BYTES) {
    return {
      ok: false,
      code: "payload_too_large",
      message: "That request is too large.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      code: "invalid_request",
      message: "Please check the form and try again.",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Please check the form and try again.",
    };
  }

  const body = parsed as Record<string, unknown>;
  const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_BODY_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Please check the form and try again.",
    };
  }

  const honeypot =
    typeof body.company_website === "string" ? body.company_website.trim() : "";

  const emailParsed = parseStudioViewRecipientEmail(body.email);
  if (!emailParsed.ok) {
    return {
      ok: false,
      code: "invalid_email",
      message: "Please enter a valid email address.",
    };
  }

  const firstNameParsed = parseOptionalFirstName(body.firstName);
  if (!firstNameParsed.ok) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Please check the form and try again.",
    };
  }

  const configuration = parseStudioConfigurationObject(body.configuration);
  if (!configuration.ok) {
    return {
      ok: false,
      code: "unsupported_configuration",
      message: "That Studio configuration isn’t available.",
    };
  }

  let attribution: AttributionSnapshot | undefined;
  if (body.attribution && typeof body.attribution === "object") {
    attribution = sanitizeAttributionRecord(
      body.attribution as Record<string, unknown>,
    );
  }

  return {
    ok: true,
    email: emailParsed.email,
    firstName: firstNameParsed.firstName,
    honeypot,
    configuration: configuration.state,
    attribution,
  };
}

export function studioViewEmailHash(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

export function readHoneypotFromJson(rawText: string): string {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (
      parsed &&
      typeof parsed === "object" &&
      "company_website" in parsed &&
      typeof (parsed as { company_website?: unknown }).company_website ===
        "string"
    ) {
      return (parsed as { company_website: string }).company_website.trim();
    }
  } catch {
    return "";
  }
  return "";
}

export function maskStudioViewEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const visible = local.slice(0, 1);
  return `${visible}•••@${domain}`;
}
