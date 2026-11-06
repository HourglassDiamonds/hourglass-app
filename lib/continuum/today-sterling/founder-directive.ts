import type { SourceNote } from "@/lib/continuum/client-memory/types";
import type { ClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import { isCustomLifecycleStage, isRepairLifecycleStage } from "@/lib/continuum/client-memory/project-lifecycle";
import {
  STERLING_ATTENTION_PRIORITIES,
  STERLING_FOUNDER_DISPOSITIONS,
  STERLING_RELATIONSHIP_ROLES,
  STERLING_RESPONSIBLE_PARTIES,
  type SterlingFounderDirectiveRecord,
} from "./types";

export const STERLING_FOUNDER_DIRECTIVE_PREFIX = "Sterling founder directive v1: ";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function oneOf(value: unknown, values: readonly string[]): value is string {
  return typeof value === "string" && values.includes(value);
}

export function validateSterlingFounderDirective(
  value: unknown,
): SterlingFounderDirectiveRecord | null {
  if (!isRecord(value)) return null;
  const projectId = value.projectId === null ? null : typeof value.projectId === "string" ? value.projectId : null;
  const personId = value.personId === null ? null : typeof value.personId === "string" ? value.personId : null;
  if (!UUID_RE.test(String(value.directiveId ?? "")) || typeof value.workUnitId !== "string" ||
      (projectId !== null && !UUID_RE.test(projectId)) || (personId !== null && !UUID_RE.test(personId)) ||
      (!projectId && !personId) || !Array.isArray(value.sourceRefs) ||
      !value.sourceRefs.every((row) => typeof row === "string" && row.length > 0 && row.length <= 240) ||
      value.sourceRefs.length > 24 || typeof value.recordedAt !== "string" || !Number.isFinite(Date.parse(value.recordedAt)) ||
      typeof value.recordedBy !== "string" || !value.recordedBy.trim() || typeof value.reason !== "string" ||
      !value.reason.trim() || value.reason.length > 500) return null;
  if (projectId && value.workUnitId !== `project:${projectId}`) return null;
  if (!projectId && !value.workUnitId.startsWith("provisional:")) return null;
  if (value.lifecycleStage !== undefined && value.lifecycleStage !== null &&
      !isCustomLifecycleStage(value.lifecycleStage) && !isRepairLifecycleStage(value.lifecycleStage)) return null;
  if (value.waitingOn !== undefined && !oneOf(value.waitingOn, STERLING_RESPONSIBLE_PARTIES)) return null;
  if (value.attentionPriority !== undefined && !oneOf(value.attentionPriority, STERLING_ATTENTION_PRIORITIES)) return null;
  if (value.relationshipRole !== undefined && !oneOf(value.relationshipRole, STERLING_RELATIONSHIP_ROLES)) return null;
  if (value.disposition !== undefined && !oneOf(value.disposition, STERLING_FOUNDER_DISPOSITIONS)) return null;
  if (value.lifecycleStage === undefined && value.waitingOn === undefined && value.attentionPriority === undefined &&
      value.relationshipRole === undefined && value.disposition === undefined) return null;
  return value as unknown as SterlingFounderDirectiveRecord;
}

export function sterlingFounderDirectiveNote(directive: SterlingFounderDirectiveRecord): string {
  const valid = validateSterlingFounderDirective(directive);
  if (!valid) throw new Error("invalid-sterling-founder-directive");
  return `${STERLING_FOUNDER_DIRECTIVE_PREFIX}${JSON.stringify(valid)}`;
}

export function sterlingFounderDirectiveFromNote(note: SourceNote): SterlingFounderDirectiveRecord | null {
  if (note.sourceSystem !== "concierge-manual" || note.deletedAt ||
      !note.noteText.startsWith(STERLING_FOUNDER_DIRECTIVE_PREFIX)) return null;
  try {
    const directive = validateSterlingFounderDirective(
      JSON.parse(note.noteText.slice(STERLING_FOUNDER_DIRECTIVE_PREFIX.length)),
    );
    if (!directive || directive.projectId !== (note.projectId ?? null) || directive.personId !== note.personId) return null;
    return directive;
  } catch {
    return null;
  }
}

export async function recordSterlingFounderDirective(input: {
  writer: Pick<ClientMemoryNoteWriter, "addManualNote">;
  directive: SterlingFounderDirectiveRecord;
}): Promise<
  | { ok: true; status: "inserted" | "already-present"; noteId: string }
  | { ok: false; reason: string }
> {
  const directive = validateSterlingFounderDirective(input.directive);
  if (!directive) return { ok: false, reason: "invalid-directive" };
  const result = await input.writer.addManualNote({
    submissionId: directive.directiveId,
    projectId: directive.projectId,
    personId: directive.personId,
    contextLayer: "client",
    noteText: sterlingFounderDirectiveNote(directive),
    actor: directive.recordedBy,
  });
  return result.ok
    ? { ok: true, status: result.status, noteId: result.noteId }
    : { ok: false, reason: result.reason };
}
