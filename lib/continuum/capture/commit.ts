import type { ClientMemoryNoteWriter } from "../client-memory/write/writer";
import { normalizeAttentionTime } from "../client-memory/project-jobs/attention-time";
import type { AttentionMetadata, OpenJobActor } from "../client-memory/project-jobs/types";
import type { ProjectJobWriter } from "../client-memory/project-jobs/writer";
import type { ConciergeSolWorld } from "../concierge-sol/world";
import {
  CAPTURE_CONTRACT_VERSION,
  type CaptureCommitInput,
  type CaptureCommitItemResult,
  type CaptureCommitResult,
  type CaptureProposedItem,
} from "./types";
import { isCaptureCommitInput } from "./validate";

export type CaptureCommitAuthority = {
  actor: string;
  world: Pick<ConciergeSolWorld, "getPersonProfile" | "getProjectDesk">;
  jobs: ProjectJobWriter;
  notes: ClientMemoryNoteWriter;
};

export type CaptureCommitDeps = {
  loadAuthority(): Promise<{ ok: true; authority: CaptureCommitAuthority } | { ok: false; reason: string }>;
};

export async function commitCapture(deps: CaptureCommitDeps, input: CaptureCommitInput): Promise<CaptureCommitResult> {
  if (!isCaptureCommitInput(input)) return { version: CAPTURE_CONTRACT_VERSION, captureId: "invalid", items: [] };
  const selected = input.items.filter((row): row is Extract<typeof row, { selected: true }> => row.selected);
  if (!selected.length) return result(input.captureId, []);
  const loaded = await deps.loadAuthority();
  if (!loaded.ok) return result(input.captureId, selected.map((row) => review(row.itemId, `Save authorization unavailable: ${loaded.reason}.`)));
  const items: CaptureCommitItemResult[] = [];
  for (const row of selected) {
    try { items.push(await saveOne(loaded.authority, row.mutationId, row.confirmedItem, input.captureId)); }
    catch { items.push({ itemId: row.itemId, status: "failed", message: "The canonical writer was unavailable." }); }
  }
  return result(input.captureId, items);
}

async function saveOne(authority: CaptureCommitAuthority, mutationId: string, item: CaptureProposedItem, captureId: string): Promise<CaptureCommitItemResult> {
  if (item.clarification) return review(item.itemId, item.clarification.question);
  if (item.entityResolution && item.entityResolution.status !== "resolved") return review(item.itemId, "Resolve the linked person or project before saving.");
  const { personId, projectId } = item.entityResolution ?? {};
  const linked = await validateLinks(authority, personId, projectId);
  if (!linked.ok) return review(item.itemId, linked.message);
  const sourceRef = `${captureId}:${item.itemId}`;
  if (item.kind === "reminder") {
    if (!item.timing || item.timing.kind === "unspecified" || item.timing.kind === "checkpoint") {
      return review(item.itemId, "Choose when this reminder should become actionable.");
    }
    const scheduled = attentionSchedule(item.timing, sourceRef, personId, projectId);
    if (!scheduled.ok) return review(item.itemId, scheduled.message);
    const written = await authority.jobs.createJob({
      mutationId, projectId: projectId ?? null, kind: "required_action", subject: item.title,
      detail: item.content, waitingOnActor: "founder", associatedPersonId: personId ?? null,
      dueAt: null, actor: authority.actor, sourceSystem: "concierge-manual", sourceRef,
      attentionMode: "reminder", activationAt: scheduled.instant, checkpointAt: null,
      attentionMetadata: scheduled.metadata,
    });
    return captureJobResult(item.itemId, written);
  }
  if (item.kind === "watching" || item.timing?.kind === "checkpoint") {
    if (item.kind !== "watching" || item.timing?.kind !== "checkpoint") {
      return review(item.itemId, "Review whether this is an Action or Watching item.");
    }
    const scheduled = watchingSchedule(item.timing, sourceRef, personId, projectId);
    if (!scheduled.ok) return review(item.itemId, scheduled.message);
    const written = await authority.jobs.createJob({
      mutationId, projectId: projectId ?? null, kind: "commitment", subject: item.title,
      detail: item.content, waitingOnActor: waitingActor(linked.roles),
      associatedPersonId: personId ?? null, dueAt: null, actor: authority.actor,
      sourceSystem: "concierge-manual", sourceRef, attentionMode: "watching",
      activationAt: null, checkpointAt: scheduled.instant,
      attentionMetadata: scheduled.metadata,
    });
    return captureJobResult(item.itemId, written);
  }
  if (item.kind === "action") {
    if (item.timing?.kind === "exact-instant") return review(item.itemId, "Choose Reminder for exact-time scheduling, or remove the exact time from this Action.");
    const written = await authority.jobs.createJob({
      mutationId, projectId: projectId ?? null, kind: "required_action", subject: item.title, detail: item.content,
      waitingOnActor: "founder", associatedPersonId: personId ?? null,
      dueAt: item.timing?.kind === "date-only" ? item.timing.date : null,
      actor: authority.actor, sourceSystem: "concierge-manual", sourceRef,
    });
    if (!written.ok) {
      if (written.code === "person-not-on-project" || written.reason === "project-not-found" || written.reason === "entity-kind-mismatch") {
        return review(item.itemId, "Review the linked Person and Project before saving.");
      }
      return failed(item.itemId, `Open Job save failed: ${written.reason}.`);
    }
    return { itemId: item.itemId, status: written.status === "created" ? "saved" : "already-present", target: { kind: "open_job", id: written.job.jobId } };
  }
  if (!personId && !projectId) return review(item.itemId, "Source Notes require a Person or Project.");
  const written = await authority.notes.addManualNote({ submissionId: mutationId, personId: personId ?? null, projectId: projectId ?? null, contextLayer: "client", noteText: item.content, actor: authority.actor });
  if (!written.ok) {
    if (written.reason === "person-not-found" || written.reason === "project-not-linked") return review(item.itemId, "Review the linked Person and Project before saving.");
    return failed(item.itemId, `Source Note save failed: ${written.reason}.`);
  }
  return { itemId: item.itemId, status: written.status === "inserted" ? "saved" : "already-present", target: { kind: "source_note", id: written.noteId } };
}

async function validateLinks(
  authority: CaptureCommitAuthority,
  personId: string | undefined,
  projectId: string | undefined,
): Promise<{ ok: true; roles: readonly string[] } | { ok: false; message: string }> {
  let roles: readonly string[] = [];
  if (personId) {
    const person = await authority.world.getPersonProfile(personId);
    if (!person.ok) return { ok: false, message: "The linked person no longer exists or is unavailable." };
    roles = person.profile.person.roles;
  }
  if (projectId) {
    const desk = await authority.world.getProjectDesk(projectId);
    if (!desk.ok) return { ok: false, message: "The linked project no longer exists or is unavailable." };
    if (personId && !desk.desk.people.some((row) => row.personId === personId)) {
      return { ok: false, message: "The person is no longer linked to the project." };
    }
  }
  return { ok: true, roles };
}

function waitingActor(roles: readonly string[]): OpenJobActor {
  if (roles.includes("vendor-contact")) return "vendor";
  if (roles.includes("client")) return "client";
  return "unknown";
}

function attentionSchedule(
  timing: Exclude<NonNullable<CaptureProposedItem["timing"]>, { kind: "unspecified" | "checkpoint" }>,
  sourceReference: string,
  personId?: string,
  projectId?: string,
): { ok: true; instant: string; metadata: AttentionMetadata } | { ok: false; message: string } {
  if (!timing.referenceInstant || !timing.timezone) {
    return { ok: false, message: "Review the reminder timezone and reference time before saving." };
  }
  const normalized = timing.kind === "date-only"
    ? normalizeAttentionTime({ kind: "date-only", localDate: timing.date, originalWording: timing.originalWording,
        referenceInstant: timing.referenceInstant, timezone: timing.timezone })
    : normalizeExact(timing);
  if (!normalized.ok) return { ok: false, message: attentionTimeMessage(normalized.reason) };
  return { ok: true, instant: normalized.instant, metadata: {
    ...normalized.metadata, sourceReference,
    ...(personId ? { targetIdentity: `person:${personId}` } : {}),
    ...(projectId ? { workstreamIdentity: `project:${projectId}` } : {}),
  } };
}

function normalizeExact(timing: Extract<NonNullable<CaptureProposedItem["timing"]>, { kind: "exact-instant" }>) {
  const instant = new Date(timing.instantAt);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timing.timezone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((row) => row.type === type)?.value ?? "";
  const localDateTime = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  const offset = /(Z|[+-]\d{2}:\d{2})$/.exec(timing.instantAt)?.[1];
  return normalizeAttentionTime({ kind: "local-date-time", localDateTime, originalWording: timing.originalWording,
    referenceInstant: timing.referenceInstant!, timezone: timing.timezone,
    ...(offset && offset !== "Z" ? { offset } : {}) });
}

function watchingSchedule(
  timing: Extract<NonNullable<CaptureProposedItem["timing"]>, { kind: "checkpoint" }>,
  sourceReference: string,
  personId?: string,
  projectId?: string,
): { ok: true; instant: string | null; metadata: AttentionMetadata } | { ok: false; message: string } {
  const referenceInstant = timing.referenceInstant;
  const timezone = timing.timezone;
  if (!referenceInstant || !timezone) {
    return { ok: false, message: "Review the Watching timezone and reference time before saving." };
  }
  if (timing.checkAt) {
    const scheduled = attentionSchedule(timing.checkAt, sourceReference, personId, projectId);
    if (!scheduled.ok) return scheduled;
    return { ok: true, instant: scheduled.instant, metadata: { ...scheduled.metadata, conditionText: timing.condition } };
  }
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(referenceInstant));
  const part = (type: Intl.DateTimeFormatPartTypes) => local.find((row) => row.type === type)?.value ?? "";
  return { ok: true, instant: null, metadata: {
    version: 1, timingPrecision: "date-only", timezone, originalWording: timing.originalWording,
    referenceInstant: new Date(referenceInstant).toISOString(),
    originalLocalDateTime: `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`,
    conditionPolicy: "review-only", conditionText: timing.condition, assumptions: [], unscheduledConfirmed: true,
    sourceReference, ...(personId ? { targetIdentity: `person:${personId}` } : {}),
    ...(projectId ? { workstreamIdentity: `project:${projectId}` } : {}),
  } };
}

function attentionTimeMessage(reason: string): string {
  if (reason === "ambiguous-local-time" || reason === "nonexistent-local-time" || reason === "timezone-offset-mismatch") {
    return "That local time is ambiguous or invalid in the selected timezone. Choose an explicit valid time.";
  }
  return "Review the date, time, and timezone before saving.";
}

function captureJobResult(itemId: string, written: Awaited<ReturnType<ProjectJobWriter["createJob"]>>): CaptureCommitItemResult {
  if (!written.ok) {
    if (written.code === "attention-creation-disabled") {
      return review(itemId, "Reminder and Watching creation is not enabled until deployment readiness is verified.");
    }
    if (written.code === "person-not-on-project" || written.reason === "project-not-found" || written.reason === "entity-kind-mismatch") {
      return review(itemId, "Review the linked Person and Project before saving.");
    }
    return failed(itemId, `Open Job save failed: ${written.reason}.`);
  }
  return { itemId, status: written.status === "created" ? "saved" : "already-present",
    target: { kind: "open_job", id: written.job.jobId } };
}

function result(captureId: string, items: CaptureCommitItemResult[]): CaptureCommitResult { return { version: CAPTURE_CONTRACT_VERSION, captureId, items }; }
function review(itemId: string, message: string): CaptureCommitItemResult { return { itemId, status: "needs-review", message }; }
function failed(itemId: string, message: string): CaptureCommitItemResult { return { itemId, status: "failed", message }; }
