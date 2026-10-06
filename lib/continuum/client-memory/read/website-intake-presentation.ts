import type { ClientWebsiteIntake } from "./website-intake";

export type ClientWebsiteIntakeField = {
  key: string;
  label: string;
  value: string;
  kind?: "email" | "phone" | "notes";
};

const FIELD_LABELS: Record<string, string> = {
  fullName: "Name",
  email: "Email",
  phone: "Phone",
  preferredContactMethod: "Preferred contact",
  category: "Inquiry category",
  projectType: "Inquiry type",
  shapeInterest: "Diamond shape",
  designDirection: "Setting / style",
  ringPresence: "Ring presence",
  budgetRange: "Budget",
  timeline: "Timeline",
  inspirationNotes: "Original notes",
  source: "Source",
};

function titleCaseKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function presentValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value.map(presentValue).filter((row): row is string => Boolean(row));
    return values.length > 0 ? values.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const values = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => {
        const presented = presentValue(child);
        return presented ? `${titleCaseKey(key)}: ${presented}` : null;
      })
      .filter((row): row is string => Boolean(row));
    return values.length > 0 ? values.join(" · ") : null;
  }
  return null;
}

export function websiteIntakeWhatMatters(intake: ClientWebsiteIntake): string {
  return [
    intake.shapeInterest,
    intake.projectType,
    intake.designDirection,
    intake.ringPresence,
    intake.budgetRange,
    intake.timeline,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
}

export function websiteIntakeFields(
  intake: ClientWebsiteIntake,
): ClientWebsiteIntakeField[] {
  const base: ClientWebsiteIntakeField[] = [
    { key: "fullName", label: FIELD_LABELS.fullName!, value: intake.fullName },
    { key: "email", label: FIELD_LABELS.email!, value: intake.email, kind: "email" as const },
    ...(intake.phone
      ? [{ key: "phone", label: FIELD_LABELS.phone!, value: intake.phone, kind: "phone" as const }]
      : []),
    {
      key: "preferredContactMethod",
      label: FIELD_LABELS.preferredContactMethod!,
      value: intake.preferredContactMethod,
    },
    { key: "category", label: FIELD_LABELS.category!, value: intake.category },
    { key: "projectType", label: FIELD_LABELS.projectType!, value: intake.projectType },
    {
      key: "shapeInterest",
      label: FIELD_LABELS.shapeInterest!,
      value: intake.shapeInterest,
    },
    {
      key: "designDirection",
      label: FIELD_LABELS.designDirection!,
      value: intake.designDirection,
    },
    {
      key: "ringPresence",
      label: FIELD_LABELS.ringPresence!,
      value: intake.ringPresence,
    },
    { key: "budgetRange", label: FIELD_LABELS.budgetRange!, value: intake.budgetRange },
    { key: "timeline", label: FIELD_LABELS.timeline!, value: intake.timeline },
    ...(intake.inspirationNotes
      ? [
          {
            key: "inspirationNotes",
            label: FIELD_LABELS.inspirationNotes!,
            value: intake.inspirationNotes,
            kind: "notes" as const,
          },
        ]
      : []),
    { key: "source", label: FIELD_LABELS.source!, value: intake.source },
  ].filter((field) => field.value.trim().length > 0);

  const attribution = Object.entries(intake.attribution)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) => {
      const presented = presentValue(value);
      return presented
        ? [{ key: `attribution.${key}`, label: titleCaseKey(key), value: presented }]
        : [];
    });

  return [...base, ...attribution];
}

export function websiteIntakeSubmittedLabel(
  submittedAt: string,
  locale = "en-US",
): string {
  const date = new Date(submittedAt);
  if (Number.isNaN(date.getTime())) return submittedAt;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
