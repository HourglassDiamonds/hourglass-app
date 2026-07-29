/**
 * Stable, non-reversible subject keys for Client Attention.
 * Never put raw email, phone, or CRM IDs into audit IDs or logs.
 */

import { createHash } from "node:crypto";

const SUBJECT_KEY_PREFIX = "subj";

/** Normalize email for matching only — never persist the normalized value as an ID. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

/** Digits-only phone for matching; returns null when too short to be reliable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Hash a normalized identity material into a stable opaque subject key. */
export function hashSubjectKey(
  kind: "email" | "phone" | "contact" | "deal" | "thread" | "submission" | "synthetic",
  material: string,
): string {
  const digest = createHash("sha256")
    .update(`hourglass-client-attention:v1:${kind}:${material}`)
    .digest("hex")
    .slice(0, 16);
  return `${SUBJECT_KEY_PREFIX}_${kind}_${digest}`;
}

export function subjectKeyFromEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return hashSubjectKey("synthetic", `invalid-email:${email.length}`);
  }
  return hashSubjectKey("email", normalized);
}

export function subjectKeyFromPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return hashSubjectKey("synthetic", `invalid-phone:${phone.length}`);
  }
  return hashSubjectKey("phone", normalized);
}

export function subjectKeyFromContactId(contactId: string): string {
  return hashSubjectKey("contact", contactId.trim());
}

export function subjectKeyFromThreadId(threadId: string): string {
  return hashSubjectKey("thread", threadId.trim());
}

export function subjectKeyFromSubmissionId(submissionId: string): string {
  return hashSubjectKey("submission", submissionId.trim());
}

/** Safe display name for founder brief — first name + optional last initial. */
export function safeDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  fallback?: string;
}): string {
  const full = (input.fullName || "").trim();
  let first = (input.firstName || "").trim();
  let last = (input.lastName || "").trim();

  if ((!first || !last) && full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (!first && parts[0]) first = parts[0];
    if (!last && parts.length > 1) last = parts[parts.length - 1];
  }

  if (first && last) {
    return `${capitalize(first)} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) return capitalize(first);
  return input.fallback ?? "A client";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
