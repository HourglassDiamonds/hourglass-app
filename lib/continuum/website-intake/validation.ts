import { createHash, randomUUID } from "node:crypto";
import { CONCIERGE_OPTION_VALUES } from "@/lib/concierge/conversational-copy";
import {
  CONCIERGE_MAX,
  normalizePreferredContactMethod,
  validateConciergeContactFields,
} from "@/lib/concierge/validation";
import { hashEmail, hashPhone } from "../client-memory/hashes";
import type { WebsiteInquiry, WebsiteIntakeCategory, WebsiteIntakeCommand } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_SUBMISSION_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

const SELECTIONS = {
  projectType: CONCIERGE_OPTION_VALUES.projectTypes,
  shapeInterest: CONCIERGE_OPTION_VALUES.shapes,
  designDirection: CONCIERGE_OPTION_VALUES.directions,
  ringPresence: CONCIERGE_OPTION_VALUES.presences,
  timeline: CONCIERGE_OPTION_VALUES.timelines,
  budgetRange: CONCIERGE_OPTION_VALUES.budgets,
} as const;

export type WebsiteInquiryFields = Omit<WebsiteInquiry, "category" | "attribution" | "source" | "acknowledgementExpected" | "synthetic">;
export type WebsiteInquiryValidation =
  | { ok: true; value: WebsiteInquiryFields }
  | { ok: false; message: string };

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : null;
}

function bounded(value: string | null, max: number): string | null {
  if (value == null || value.length > max || value.includes("\0")) return null;
  return value;
}

function selection<K extends keyof typeof SELECTIONS>(field: K, value: string | null): string | null {
  if (!value || value.length > CONCIERGE_MAX.selection) return null;
  return (SELECTIONS[field] as readonly string[]).includes(value) ? value : null;
}

export function validateWebsiteInquiryFormData(formData: FormData): WebsiteInquiryValidation {
  const rawFullName = bounded(text(formData, "fullName"), CONCIERGE_MAX.fullName);
  const rawEmail = bounded(text(formData, "email"), CONCIERGE_MAX.email);
  const rawPhone = bounded(text(formData, "phone"), CONCIERGE_MAX.phone);
  const rawNotes = bounded(text(formData, "inspirationNotes"), CONCIERGE_MAX.inspirationNotes);
  const rawPreferred = bounded(text(formData, "preferredContactMethod"), CONCIERGE_MAX.selection);
  if (rawFullName == null || rawEmail == null || rawPhone == null || rawNotes == null || rawPreferred == null) {
    return { ok: false, message: "Please check the form and try again." };
  }

  const contact = validateConciergeContactFields({
    fullName: rawFullName,
    email: rawEmail,
    phone: rawPhone,
    preferredContactMethod: rawPreferred,
    inspirationNotes: rawNotes,
  });
  if (!contact.ok) return contact;
  const preferredContactMethod = normalizePreferredContactMethod(rawPreferred);
  if (!preferredContactMethod) return { ok: false, message: "Please check the form and try again." };

  const projectType = selection("projectType", text(formData, "projectType"));
  const shapeInterest = selection("shapeInterest", text(formData, "shapeInterest"));
  const designDirection = selection("designDirection", text(formData, "designDirection"));
  const ringPresence = selection("ringPresence", text(formData, "ringPresence"));
  const timeline = selection("timeline", text(formData, "timeline"));
  const budgetRange = selection("budgetRange", text(formData, "budgetRange"));
  if (!projectType || !shapeInterest || !designDirection || !ringPresence || !timeline || !budgetRange) {
    return { ok: false, message: "Please check the form and try again." };
  }

  const submittedId = bounded(text(formData, "submissionId"), CONCIERGE_MAX.submissionId);
  const submissionId = submittedId && OPAQUE_SUBMISSION_ID_RE.test(submittedId)
    ? (UUID_RE.test(submittedId) ? submittedId.toLowerCase() : submittedId)
    : randomUUID();
  return {
    ok: true,
    value: {
      submissionId,
      fullName: contact.fullName.replace(/[\r\n]+/g, " "),
      email: contact.email,
      phone: contact.phone,
      preferredContactMethod,
      projectType,
      shapeInterest,
      designDirection,
      ringPresence,
      timeline,
      budgetRange,
      inspirationNotes: contact.notes,
    },
  };
}

export function classifyWebsiteInquiry(projectType: string): WebsiteIntakeCategory {
  if (projectType === "Engagement Ring") return "engagement_ring";
  if (projectType === "Custom Jewelry") return "custom_design";
  if (projectType === "Wedding Band") return "wedding_bands";
  return "other";
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type GeneratedId = "intakeId" | "personId" | "emailIdentityId" | "phoneIdentityId" | "identityReviewId" | "jobId" | "jobMutationId";

export function buildWebsiteIntakeCommand(
  inquiry: WebsiteInquiry,
  options?: { now?: string; ids?: Partial<Record<GeneratedId, string>> },
): WebsiteIntakeCommand {
  const emailHash = hashEmail(inquiry.email);
  if (!emailHash) throw new Error("invalid-email");
  const ids = options?.ids ?? {};
  return {
    ...inquiry,
    intakeId: ids.intakeId ?? randomUUID(),
    personId: ids.personId ?? randomUUID(),
    emailIdentityId: ids.emailIdentityId ?? randomUUID(),
    phoneIdentityId: ids.phoneIdentityId ?? randomUUID(),
    identityReviewId: ids.identityReviewId ?? randomUUID(),
    jobId: ids.jobId ?? randomUUID(),
    jobMutationId: ids.jobMutationId ?? randomUUID(),
    idempotencyKeyHash: sha256(`hourglass:website-intake:v1:${inquiry.submissionId}`),
    payloadHash: sha256(stableJson(inquiry)),
    emailHash,
    phoneHash: hashPhone(inquiry.phone),
    submittedAt: options?.now ?? new Date().toISOString(),
  };
}

export function splitInquiryName(fullName: string): { givenName: string; familyName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  return { givenName: parts[0]!, familyName: parts.slice(1).join(" ") || null };
}
