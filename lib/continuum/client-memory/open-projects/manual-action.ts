/**
 * Founder-entered actionable work for Current Projects / Command Center.
 * Ownership is founder only because the founder is explicitly creating it.
 * Does not mint People, change Kind/lifecycle, or infer jobs from status.
 */

import { isOpenJobUuid, parseOptionalIso, parseOpenJobSubject } from "../project-jobs/validate";
import type { CreateProjectJobInput } from "../project-jobs/create";
import { isLifecycleBusyworkLabel } from "./hydrate";

export const FOUNDER_MANUAL_ACTION_KIND = "required_action" as const;
export const FOUNDER_MANUAL_ACTION_ACTOR = "founder" as const;
export const FOUNDER_MANUAL_ACTION_SOURCE = "concierge-manual" as const;

export type FounderManualActionInput = {
  mutationId: string;
  projectId: string;
  subject: string;
  associatedPersonId?: string | null;
  dueAt?: string | null;
  actor: string;
};

export type FounderManualActionInvalidCode =
  | "invalid-id"
  | "invalid-subject"
  | "lifecycle-busywork"
  | "invalid-due";

export type FounderManualActionResult =
  | { ok: true; input: CreateProjectJobInput }
  | { ok: false; code: FounderManualActionInvalidCode };

export function founderManualActionInput(
  raw: FounderManualActionInput,
): FounderManualActionResult {
  const mutationId = raw.mutationId.trim();
  const projectId = raw.projectId.trim();
  if (!isOpenJobUuid(mutationId) || !isOpenJobUuid(projectId)) {
    return { ok: false, code: "invalid-id" };
  }
  const subject = parseOpenJobSubject(raw.subject);
  if (!subject.ok) return { ok: false, code: "invalid-subject" };
  if (isLifecycleBusyworkLabel(subject.subject)) {
    return { ok: false, code: "lifecycle-busywork" };
  }
  const associatedPersonId = raw.associatedPersonId?.trim() || null;
  if (associatedPersonId && !isOpenJobUuid(associatedPersonId)) {
    return { ok: false, code: "invalid-id" };
  }
  const dueAt = parseOptionalIso(raw.dueAt);
  if (!dueAt.ok) return { ok: false, code: "invalid-due" };

  return {
    ok: true,
    input: {
      mutationId,
      projectId,
      kind: FOUNDER_MANUAL_ACTION_KIND,
      subject: subject.subject,
      waitingOnActor: FOUNDER_MANUAL_ACTION_ACTOR,
      associatedPersonId,
      dueAt: dueAt.value,
      actor: raw.actor,
      sourceSystem: FOUNDER_MANUAL_ACTION_SOURCE,
    },
  };
}

export function promoteExplicitActionInput(input: {
  mutationId: string;
  projectId: string;
  subject: string;
  associatedPersonId?: string | null;
  actor: string;
}): FounderManualActionResult {
  return founderManualActionInput(input);
}
