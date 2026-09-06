/**
 * Human-facing labels for Concierge Client Memory UI.
 * Does not invent provenance or mutate stored data.
 */

import type {
  ConciergePersonProfile,
  LinkedProjectRead,
  PersonFact,
  SourceNoteSummary,
  WishSummary,
} from "@/lib/continuum/client-memory/read/types";
import type {
  RelationshipContextLayer,
  RelationshipKind,
} from "@/lib/continuum/client-memory/types";
import {
  PROJECT_SPEC_FIELD_LABELS,
  PROJECT_SPEC_HISTORY_KEY,
} from "@/lib/continuum/client-memory/project-spec/types";
import { EDITABLE_PROJECT_SPEC_FIELDS, CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { formatBirthday, parseBirthdayValue } from "@/lib/continuum/client-memory/facts/date";
import { PERSON_FACT_TYPE_BIRTHDAY } from "@/lib/continuum/client-memory/facts/types";

export const CONCIERGE_HOME_PATH = "/executive-dashboard/concierge";
export const CONCIERGE_PROJECTS_PATH = `${CONCIERGE_HOME_PATH}/projects`;

export function conciergeClientPath(personId: string): string {
  return `${CONCIERGE_HOME_PATH}/client/${personId}`;
}

export function conciergeProjectsPath(): string {
  return CONCIERGE_PROJECTS_PATH;
}

export const CONCIERGE_COHORT_1_PATH =
  `${CONCIERGE_HOME_PATH}/project-reconstruction/cohort-1` as const;

export function conciergeCohort1Path(): string {
  return CONCIERGE_COHORT_1_PATH;
}

export function conciergeCohort1ProjectPath(projectId: string): string {
  return `${CONCIERGE_COHORT_1_PATH}/${projectId.trim()}`;
}

export function conciergeProjectPath(projectId: string): string {
  return `${CONCIERGE_PROJECTS_PATH}/${projectId}`;
}

export function conciergeCorrectProjectSpecPath(
  projectId: string,
  fieldName: string,
): string {
  return `${conciergeProjectPath(projectId)}/correct/${fieldName}`;
}

export function conciergeCorrectProjectKindPath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/kind`;
}

export function conciergeCorrectProjectLifecyclePath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/lifecycle`;
}

export function conciergeAddOpenJobPath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/jobs/new`;
}

export function conciergeOpenJobPath(projectId: string, jobId: string): string {
  return `${conciergeProjectPath(projectId)}/jobs/${jobId}`;
}

export function conciergeAddProjectArtifactPath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/artifacts/new`;
}

export function conciergeCopyGmailProjectArtifactPath(
  projectId: string,
  query?: { messageId?: string; attachmentId?: string },
): string {
  const path = `${conciergeProjectPath(projectId)}/artifacts/copy-from-gmail`;
  const params = new URLSearchParams();
  if (query?.messageId?.trim()) params.set("messageId", query.messageId.trim());
  if (query?.attachmentId?.trim()) {
    params.set("attachmentId", query.attachmentId.trim());
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function conciergeProjectArtifactFilePath(
  projectId: string,
  artifactId: string,
): string {
  return `${conciergeProjectPath(projectId)}/artifacts/${artifactId}/file`;
}

export function conciergeProjectCustomPath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/custom`;
}

export function conciergeProjectRepairPath(projectId: string): string {
  return `${conciergeProjectPath(projectId)}/repair`;
}

export function conciergeCorrectOperatingDetailPath(
  projectId: string,
  fieldName: string,
): string {
  if (fieldName.startsWith("repair_")) {
    return `${conciergeProjectRepairPath(projectId)}/${fieldName}`;
  }
  return `${conciergeProjectCustomPath(projectId)}/${fieldName}`;
}

export function conciergeAddNotePath(personId: string): string {
  return `${conciergeClientPath(personId)}/note/new`;
}

export function conciergeBirthdayPath(personId: string): string {
  return `${conciergeClientPath(personId)}/birthday`;
}

export function conciergeAddNotePickerPath(): string {
  return `${CONCIERGE_HOME_PATH}/note/new`;
}

export function conciergeInboxPath(): string {
  return `${CONCIERGE_HOME_PATH}/inbox`;
}

export function conciergeInboxNewPath(): string {
  return `${conciergeInboxPath()}/new`;
}

export function conciergeInboxSourcePath(sourceId: string): string {
  return `${conciergeInboxPath()}/${sourceId}`;
}

export function conciergeAddClientPath(): string {
  return `${CONCIERGE_HOME_PATH}/client/new`;
}

export function conciergeEditPersonPath(personId: string): string {
  return `${conciergeClientPath(personId)}/edit`;
}

export function conciergeHistoryPath(
  personId: string,
  query?: { page?: number; source?: string | null; lifecycle?: "trashed" | null },
): string {
  const path = `${conciergeClientPath(personId)}/history`;
  const params = new URLSearchParams();
  if (query?.page && query.page > 1) params.set("page", String(query.page));
  if (query?.source?.trim()) params.set("source", query.source.trim());
  if (query?.lifecycle === "trashed") params.set("lifecycle", "trashed");
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function conciergeEditNotePath(personId: string, noteId: string): string {
  return `${conciergeClientPath(personId)}/note/${noteId}/edit`;
}

export function conciergeMoveNotePath(personId: string, noteId: string): string {
  return `${conciergeClientPath(personId)}/note/${noteId}/move`;
}

export function conciergeTrashNotePath(personId: string, noteId: string): string {
  return `${conciergeClientPath(personId)}/note/${noteId}/trash`;
}

export function conciergeRestoreNotePath(personId: string, noteId: string): string {
  return `${conciergeClientPath(personId)}/note/${noteId}/restore`;
}

export const RELATIONSHIP_CONTEXT_LAYER_LABELS: Record<
  RelationshipContextLayer,
  string
> = {
  client: "Client",
  networking: "Networking",
  personal: "Personal",
};

export function noteContextLabel(layer: RelationshipContextLayer): string {
  return RELATIONSHIP_CONTEXT_LAYER_LABELS[layer];
}

const RELATIONSHIP_LABELS: Partial<Record<RelationshipKind, string>> = {
  spouse: "Spouse",
  partner: "Partner",
  child: "Family",
  parent: "Family",
  family: "Family",
  friend: "Friend",
  assistant: "Assistant",
  "business-partner": "Business partner",
  referral: "Referral",
  "gift-planning": "Gift planning",
  "household-member": "Household",
};

export function relationshipLabel(kind: RelationshipKind): string | null {
  if (kind === "client-project") return null;
  return RELATIONSHIP_LABELS[kind] ?? null;
}

export function formatLocation(person: ConciergePersonProfile["person"]): string | null {
  const parts = [person.city, person.state, person.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) {
    return person.streetAddress?.trim() || null;
  }
  return parts.join(", ");
}

export function formatFactLabel(factType: string): string {
  return factType
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatFactValue(fact: PersonFact): string | null {
  if (fact.factType === PERSON_FACT_TYPE_BIRTHDAY) {
    const parsed = parseBirthdayValue(fact.value);
    if (parsed.ok) return formatBirthday(parsed.value);
  }
  const value = fact.value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return null;
}

export function currentBirthdayFact(facts: PersonFact[]): PersonFact | null {
  return (
    facts.find(
      (fact) =>
        fact.factType === PERSON_FACT_TYPE_BIRTHDAY && fact.status === "current",
    ) ?? null
  );
}

export function visibleCurrentFacts(facts: PersonFact[]): Array<{
  id: string;
  label: string;
  value: string;
}> {
  return facts
    .filter((fact) => fact.status === "current")
    .map((fact) => {
      const value = formatFactValue(fact);
      if (!value) return null;
      return { id: fact.id, label: formatFactLabel(fact.factType), value };
    })
    .filter((row): row is { id: string; label: string; value: string } => row != null);
}

export function noteSourceLabel(note: Pick<SourceNoteSummary, "sourceSystem">): string {
  if (note.sourceSystem === CLIENT_MEMORY_SOURCE_SYSTEM) {
    return "Historical client record";
  }
  switch (String(note.sourceSystem)) {
    case "concierge-manual":
      return "Concierge";
    case "gmail":
      return "Email";
    case "plaud":
      return "PLAUD";
    case "remarkable":
      return "reMarkable";
    default:
      return "Client history";
  }
}

export function noteProjectTitle(
  note: SourceNoteSummary,
  projectTitles: Map<string, string> | Record<string, string>,
): string | null {
  if (!note.projectId) return null;
  const title =
    projectTitles instanceof Map
      ? projectTitles.get(note.projectId)
      : projectTitles[note.projectId];
  const trimmed = title?.trim();
  return trimmed ? trimmed : null;
}

export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function projectCountLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 project" : `${count} projects`;
}

export function reviewIndicatorLabel(openCount: number): string | null {
  if (openCount <= 0) return null;
  return openCount === 1 ? "Needs review · 1" : `${openCount} items to review`;
}

export function memoryReviewLabel(
  candidateCount: number,
  conflictingCount: number,
): string | null {
  const total = candidateCount + conflictingCount;
  if (total <= 0) return null;
  return total === 1 ? "1 memory needs review" : `${total} memories need review`;
}

export function mailtoHref(email: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return `mailto:${trimmed}`;
}

export function telHref(phone: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return null;
}

export function wishHeadline(wish: WishSummary): string {
  return wish.description.trim();
}

export function historyFields(project: LinkedProjectRead): Array<{
  fieldName: (typeof EDITABLE_PROJECT_SPEC_FIELDS)[number];
  label: string;
  value: string;
}> {
  const history = project.internalHistory;
  if (!history) return [];
  const rows: Array<{
    fieldName: (typeof EDITABLE_PROJECT_SPEC_FIELDS)[number];
    label: string;
    value: string;
  }> = [];
  for (const fieldName of EDITABLE_PROJECT_SPEC_FIELDS) {
    const key = PROJECT_SPEC_HISTORY_KEY[fieldName];
    const trimmed = history[key]?.trim();
    if (!trimmed) continue;
    rows.push({
      fieldName,
      label: PROJECT_SPEC_FIELD_LABELS[fieldName],
      value: trimmed,
    });
  }
  return rows;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersonIdParam(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isProjectIdParam(value: string): boolean {
  return UUID_RE.test(value.trim());
}
