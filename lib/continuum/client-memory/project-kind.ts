/**
 * Canonical Project Kind. Founder-explicit only.
 * NULL / absent means unclassified. "other" is an explicit choice.
 * Does not imply lifecycle, workflow, or commercial state.
 */

export const PROJECT_KINDS = [
  "custom_new_jewelry",
  "repair_service",
  "loose_stone_sourcing",
  "consultation_opportunity",
  "other",
] as const;

export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_FIELD = "project_kind" as const;

export const PROJECT_KIND_NOT_SET_LABEL = "Not set";
export const PROJECT_KIND_NOT_SET_COMPACT = "Kind not set";
export const PROJECT_KIND_CLEAR_LABEL = "Clear / Not set";

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  custom_new_jewelry: "Custom / New Jewelry",
  repair_service: "Repair / Service",
  loose_stone_sourcing: "Loose Stone / Sourcing",
  consultation_opportunity: "Consultation / Opportunity",
  other: "Other",
};

export const PROJECT_KIND_CHIP_LABELS: Record<ProjectKind, string> = {
  custom_new_jewelry: "CUSTOM / NEW JEWELRY",
  repair_service: "REPAIR / SERVICE",
  loose_stone_sourcing: "LOOSE STONE / SOURCING",
  consultation_opportunity: "CONSULTATION / OPPORTUNITY",
  other: "OTHER",
};

export function isProjectKind(value: unknown): value is ProjectKind {
  return (
    typeof value === "string" &&
    (PROJECT_KINDS as readonly string[]).includes(value)
  );
}

export function isProjectKindField(
  value: unknown,
): value is typeof PROJECT_KIND_FIELD {
  return value === PROJECT_KIND_FIELD;
}

export function projectKindLabel(kind: ProjectKind | null | undefined): string {
  if (!kind) return PROJECT_KIND_NOT_SET_LABEL;
  return PROJECT_KIND_LABELS[kind];
}

export function projectKindChipLabel(kind: ProjectKind): string {
  return PROJECT_KIND_CHIP_LABELS[kind];
}

export function projectKindOf(
  value: { projectKind?: ProjectKind | null } | null | undefined,
): ProjectKind | null {
  return value?.projectKind ?? null;
}

export function projectKindFromUnknown(value: unknown): ProjectKind | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isProjectKind(trimmed) ? trimmed : null;
}

export type ParseProjectKindInputResult =
  | { ok: true; kind: ProjectKind | null }
  | { ok: false; reason: "invalid-value" };

export function parseProjectKindInput(
  value: unknown,
): ParseProjectKindInputResult {
  if (value == null) return { ok: true, kind: null };
  if (typeof value !== "string") return { ok: false, reason: "invalid-value" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, kind: null };
  if (isProjectKind(trimmed)) return { ok: true, kind: trimmed };
  return { ok: false, reason: "invalid-value" };
}
