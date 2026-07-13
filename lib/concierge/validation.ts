/** Concierge field validation — shared by API and tests. No PII in messages. */

export const CONCIERGE_MAX = {
  fullName: 120,
  email: 254,
  phone: 40,
  inspirationNotes: 5000,
  selection: 80,
  submissionId: 80,
} as const;

export type PreferredContactMethod = "email" | "phone" | "text" | "any";

export function normalizePreferredContactMethod(
  value: string | undefined,
): PreferredContactMethod | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  if (key === "email" || key === "phone" || key === "text" || key === "any") {
    return key;
  }
  if (key === "any is fine") return "any";
  return undefined;
}

export function phoneRequiredForContactMethod(
  method: PreferredContactMethod | undefined,
): boolean {
  return method === "phone" || method === "text";
}

/** Count digits only — rejects empty / placeholder phone values. */
export function phoneDigitCount(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

export function isValidPhoneForContact(phone: string): boolean {
  return phoneDigitCount(phone) >= 7 && phone.trim().length <= CONCIERGE_MAX.phone;
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > CONCIERGE_MAX.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function truncateField(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export type ConciergeFieldValidation =
  | { ok: true; fullName: string; email: string; phone: string; notes: string }
  | { ok: false; message: string };

export function validateConciergeContactFields(input: {
  fullName: string;
  email: string;
  phone: string;
  preferredContactMethod: string;
  inspirationNotes: string;
}): ConciergeFieldValidation {
  const fullName = truncateField(input.fullName, CONCIERGE_MAX.fullName);
  const email = truncateField(input.email, CONCIERGE_MAX.email).toLowerCase();
  const phone = truncateField(input.phone, CONCIERGE_MAX.phone);
  const notes = truncateField(
    input.inspirationNotes,
    CONCIERGE_MAX.inspirationNotes,
  );
  const method = normalizePreferredContactMethod(input.preferredContactMethod);

  if (!fullName) {
    return { ok: false, message: "Please enter your name." };
  }

  if (!isValidEmail(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  if (phoneRequiredForContactMethod(method) && !isValidPhoneForContact(phone)) {
    return {
      ok: false,
      message: "Please enter a phone number so we can reach you that way.",
    };
  }

  return { ok: true, fullName, email, phone, notes };
}
