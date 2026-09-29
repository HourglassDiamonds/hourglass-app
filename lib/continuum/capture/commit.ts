import type { ClientMemoryNoteWriter } from "../client-memory/write/writer";
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
  if (item.timing?.kind === "exact-instant") return review(item.itemId, "Exact-time reminder persistence requires the later schema extension.");
  if (item.kind === "reminder") return review(item.itemId, "Reminder persistence requires the later schema extension.");
  if (item.kind === "watching" || item.timing?.kind === "checkpoint") return review(item.itemId, "Watching and checkpoint persistence requires the later schema extension.");
  if (item.kind === "action") {
    if (personId) {
      const person = await authority.world.getPersonProfile(personId);
      if (!person.ok) return review(item.itemId, "The linked person no longer exists or is unavailable.");
    }
    if (projectId) {
      const desk = await authority.world.getProjectDesk(projectId);
      if (!desk.ok) return review(item.itemId, "The linked project no longer exists or is unavailable.");
      if (personId && !desk.desk.people.some((row) => row.personId === personId)) return review(item.itemId, "The person is no longer linked to the project.");
    }
    const written = await authority.jobs.createJob({
      mutationId, projectId: projectId ?? null, kind: "required_action", subject: item.title, detail: item.content,
      waitingOnActor: "founder", associatedPersonId: personId ?? null,
      dueAt: item.timing?.kind === "date-only" ? item.timing.date : null,
      actor: authority.actor, sourceSystem: "concierge-manual", sourceRef: `${captureId}:${item.itemId}`,
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
  if (personId) {
    const person = await authority.world.getPersonProfile(personId);
    if (!person.ok) return review(item.itemId, "The linked person no longer exists or is unavailable.");
  }
  if (projectId) {
    const desk = await authority.world.getProjectDesk(projectId);
    if (!desk.ok || (personId && !desk.desk.people.some((row) => row.personId === personId))) return review(item.itemId, "The person is no longer linked to the project.");
  }
  const written = await authority.notes.addManualNote({ submissionId: mutationId, personId: personId ?? null, projectId: projectId ?? null, contextLayer: "client", noteText: item.content, actor: authority.actor });
  if (!written.ok) {
    if (written.reason === "person-not-found" || written.reason === "project-not-linked") return review(item.itemId, "Review the linked Person and Project before saving.");
    return failed(item.itemId, `Source Note save failed: ${written.reason}.`);
  }
  return { itemId: item.itemId, status: written.status === "inserted" ? "saved" : "already-present", target: { kind: "source_note", id: written.noteId } };
}

function result(captureId: string, items: CaptureCommitItemResult[]): CaptureCommitResult { return { version: CAPTURE_CONTRACT_VERSION, captureId, items }; }
function review(itemId: string, message: string): CaptureCommitItemResult { return { itemId, status: "needs-review", message }; }
function failed(itemId: string, message: string): CaptureCommitItemResult { return { itemId, status: "failed", message }; }
