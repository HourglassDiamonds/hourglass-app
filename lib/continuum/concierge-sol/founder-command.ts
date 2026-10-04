/** Closed, explicit founder command grammar. Ordinary conversation never writes. */
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type {
  ProjectDeskSummary,
  ProjectDeskNote,
} from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import type { ClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import type { TodayBriefingPacket } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";

export type FounderCorrectionScope = {
  itemId: string;
  workLoopId: string;
  projectId: string | null;
  personId: string | null;
  cadIds: string[];
  sourceRefs: string[];
};

export type FounderOperation =
  | {
      kind: "clarify";
      target: string;
      question: string;
    }
  | {
      kind: "snooze" | "resolve" | "cancel";
      target: string;
      days: number | null;
    }
  | {
      kind: "correct";
      target: string;
      truth: NonNullable<SourceCommunicationEvent["correction"]>;
      wording: string;
      scope?: FounderCorrectionScope;
    };
const PREFIX = "Founder current truth v1: ";
const SCOPED_PREFIX = "Founder current truth v2: ";
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function proposeFounderOperation(
  query: string,
): FounderOperation | null {
  const text = query.trim();
  if (
    /\b(?:is wrong|was wrong|actually|but|on second thought|already replied|actually no)\b/i.test(
      text,
    )
  )
    return {
      kind: "clarify",
      target: "",
      question:
        "I found conflicting current-state statements. Please restate one final state, for example: “Ben is waiting on the client” or “Ben is waiting on me.”",
    };
  if (
    /\?|\b(?:if|maybe|perhaps|I think|should we|could be|might|not in production|not in manufacturing)\b/i.test(
      text,
    )
  )
    return null;
  const command = text.match(
    /^(?:please\s+)?(snooze|resolve|cancel)\s+(.+?)(?:\s+for\s+(\d+)\s+days?)?[.!]?$/i,
  );
  if (command)
    return {
      kind: command[1].toLowerCase() as "snooze" | "resolve" | "cancel",
      target: command[2].trim(),
      days: command[3] ? +command[3] : null,
    };
  const state = text.match(
    /^(.{1,100}?)\s+is\s+(?:now\s+)?(in (?:manufacturing|production)|waiting (?:on|for) .+|(?:my|the founder's) (?:move|turn))[.!]?$/i,
  );
  const alternate = text.match(/^waiting (?:on|for) (.{1,100}?) to reply\b/i);
  if (!state && !alternate) return null;
  const target = state?.[1] ?? alternate![1];
  const body = state?.[2] ?? text;
  let truth: NonNullable<SourceCommunicationEvent["correction"]>;
  if (/^in (?:manufacturing|production)[.!]?$/i.test(body))
    truth = {
      stage: "in_production",
      ballHolder: "vendor_shop",
      dependency: "vendor production",
    };
  else if (/^(?:my|the founder's) (?:move|turn)[.!]?$/i.test(body))
    truth = { ballHolder: "founder", dependency: "founder action" };
  else if (/^waiting (?:on|for)\b/i.test(body)) {
    const actor = /\bheld until\b/i.test(body)
      ? "unknown"
      : /\b(?:me|founder|my approval)\b/i.test(body)
      ? "founder"
      : /\b(?:shop|vendor|CAD|STL)\b/i.test(body)
        ? "vendor_shop"
        : /\b(?:client|him|her|reply|response)\b/i.test(body)
          ? "client"
          : "unknown";
    const dependency = /\bfinger size\b/i.test(body)
      ? "client reply / finger size"
      : body
          .replace(/^waiting (?:on|for)\s+/i, "")
          .split(/[;—]/)[0]
          .replace(/[.!]$/, "")
          .trim();
    truth = { ballHolder: actor, dependency };
  } else return null;
  return { kind: "correct", target: target.trim(), truth, wording: text };
}

/** Resolve explicit row-scoped commands without asking the founder to repeat the row name. */
export function proposeTodayFounderOperation(
  query: string,
  packet: TodayBriefingPacket,
  now = new Date(),
): FounderOperation | null {
  const text = query.replace(/\s+/g, " ").trim();
  if (!text || /\?|\b(?:maybe|perhaps|I think|should we|could be|might)\b/i.test(text)) return null;
  const target = packet.displayName || packet.projectName || packet.itemId;
  const scope = correctionScope(packet);

  if (/\b(?:already handled|already took care of|this is done|mark (?:this|it) done)\b/i.test(text)) {
    return { kind: "resolve", target, days: null };
  }
  if (/\b(?:don['’]?t show me this again|do not show me this again|dismiss (?:this|it) permanently)\b/i.test(text)) {
    return { kind: "cancel", target, days: null };
  }
  if (/\b(?:bring (?:this|it) back|snooze (?:this|it))\b/i.test(text)) {
    const weekday = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1];
    const explicitDays = text.match(/\b(?:in|for)\s+(\d{1,3})\s+days?\b/i)?.[1];
    const days = explicitDays ? Number(explicitDays) : weekday ? daysUntilWeekday(now, weekday) : null;
    if (days) return { kind: "snooze", target, days };
  }
  if (/\bhold\b/i.test(text)) {
    const condition = text.match(/\b(?:until|while)\s+(.+?)[.!]?$/i)?.[1]?.trim() || "the founder releases the hold";
    return {
      kind: "correct",
      target,
      truth: { ballHolder: "unknown", dependency: `held until ${condition}` },
      wording: `${target} is waiting on held until ${condition}.`,
      scope,
    };
  }
  const backburner = text.match(/\b([A-Z][a-z]+)\s+can be put on the backburner\b/i);
  if (backburner && /\bring size\b/i.test(text)) {
    return {
      kind: "correct",
      target,
      truth: { ballHolder: "unknown", dependency: "waiting for ring size" },
      wording: `${backburner[1]} is waiting for ring size.`,
      scope,
    };
  }
  if (/\b(?:this job|this|it)\s+is\s+(?:now\s+)?in (?:production|manufacturing)\b/i.test(text)) {
    return {
      kind: "correct",
      target,
      truth: { stage: "in_production", ballHolder: "vendor_shop", dependency: "vendor production" },
      wording: `${target} is in production.`,
      scope,
    };
  }
  if (/^waiting (?:on|for)\b/i.test(text)) {
    const operation = proposeFounderOperation(`${target} is ${text.replace(/[.!]$/, "")}.`);
    return operation?.kind === "correct" ? { ...operation, scope } : operation;
  }
  return null;
}

export function looksLikeTodayFounderDirective(query: string): boolean {
  const text = query.replace(/\s+/g, " ").trim();
  if (!text || /\?/.test(text)) return false;
  return /\b(?:move|put|mark|hold|backburner|waiting|snooze|dismiss|resolve|cancel|production|manufacturing|already handled|took care of)\b/i.test(text);
}

function correctionScope(packet: TodayBriefingPacket): FounderCorrectionScope {
  const cadIds = packet.identifiers
    .filter((row) => row.current && row.role === "cadId")
    .map((row) => row.value);
  const itemScope = packet.itemId.startsWith("brief:")
    ? packet.itemId.slice("brief:".length)
    : packet.itemId;
  const itemCad = itemScope.match(/^cad:(C\d{5,}(?:-[A-Z0-9]+)?)$/i)?.[1];
  if (itemCad && !cadIds.some((value) => fold(value) === fold(itemCad))) cadIds.unshift(itemCad);
  return {
    itemId: packet.itemId,
    workLoopId: itemScope || (packet.projectId ? `project:${packet.projectId}` : packet.itemId),
    projectId: packet.projectId,
    personId: packet.personId,
    cadIds: [...new Set(cadIds)].slice(0, 8),
    sourceRefs: [...new Set(packet.sourceRefs)].slice(0, 12),
  };
}

function daysUntilWeekday(now: Date, weekday: string): number {
  const index = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday.toLowerCase());
  if (index < 0) return 0;
  const delta = (index - now.getDay() + 7) % 7;
  return delta || 7;
}
export function correctionNote(
  operation: Extract<FounderOperation, { kind: "correct" }>,
): string {
  return (operation.scope ? SCOPED_PREFIX : PREFIX) + JSON.stringify(operation);
}
export function correctionEventsFromNotes(
  projectId: string | null,
  notes: readonly ProjectDeskNote[],
): SourceCommunicationEvent[] {
  return notes.flatMap((note) => {
    if (
      note.sourceSystem !== "concierge-manual" ||
      !note.noteText.startsWith(PREFIX) && !note.noteText.startsWith(SCOPED_PREFIX)
    )
      return [];
    try {
      const scoped = note.noteText.startsWith(SCOPED_PREFIX);
      const raw = JSON.parse(note.noteText.slice(scoped ? SCOPED_PREFIX.length : PREFIX.length));
      const operation = scoped ? readScopedCorrection(raw) : typeof raw.wording === "string" ? proposeFounderOperation(raw.wording) : null;
      if (
        !operation ||
        operation.kind !== "correct" ||
        (!scoped && JSON.stringify(operation) !== JSON.stringify(raw))
      )
        return [];
      return [
        {
          sourceType: "founder_note",
          sourceRef: `founder-note:${note.id}`,
          messageId: note.id,
          threadId: null,
          timestamp: note.createdAt,
          direction: "outbound",
          actor: "founder",
          subject: null,
          authorOwnedText: operation.wording,
          quotedText: "",
          attachmentFilenames: [],
          hasAttachments: false,
          cadIds: operation.scope?.cadIds ?? [],
          orderIds: [],
          productionJobIds: [],
          personLabel: operation.target,
          projectId: operation.scope?.projectId ?? projectId,
          workLoopId: operation.scope?.workLoopId ?? (projectId ? `project:${projectId}` : null),
          semanticClass: "founder_correction",
          evidenceExcerpt: operation.wording,
          workIdentityBasis: operation.scope?.cadIds.length ? "cad" : projectId ? "project" : null,
          provenance: "founder_correction",
          correction: operation.truth,
        } satisfies SourceCommunicationEvent,
      ];
    } catch {
      return [];
    }
  });
}

function readScopedCorrection(raw: unknown): Extract<FounderOperation, { kind: "correct" }> | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<Extract<FounderOperation, { kind: "correct" }>>;
  const scope = row.scope as Partial<FounderCorrectionScope> | undefined;
  const truth = row.truth;
  if (row.kind !== "correct" || typeof row.target !== "string" || typeof row.wording !== "string" || !truth || !scope) return null;
  if (!(["founder", "client", "vendor_shop", "unknown"] as const).includes(truth.ballHolder as never)) return null;
  if (typeof truth.dependency !== "string" && truth.dependency !== null) return null;
  if (typeof scope.itemId !== "string" || typeof scope.workLoopId !== "string") return null;
  if (!Array.isArray(scope.cadIds) || !Array.isArray(scope.sourceRefs)) return null;
  const stages = ["queued", "design_requested", "cad_review", "revision_requested", "approved", "order_confirmed", "in_production", "waiting_external", "ready", "complete"] as const;
  if (truth.stage != null && !stages.includes(truth.stage)) return null;
  return {
    kind: "correct",
    target: row.target.slice(0, 100),
    truth: { ...(truth.stage ? { stage: truth.stage } : {}), ballHolder: truth.ballHolder, dependency: truth.dependency },
    wording: row.wording.slice(0, 400),
    scope: {
      itemId: scope.itemId.slice(0, 200),
      workLoopId: scope.workLoopId.slice(0, 200),
      projectId: typeof scope.projectId === "string" ? scope.projectId : null,
      personId: typeof scope.personId === "string" ? scope.personId : null,
      cadIds: scope.cadIds.filter((value): value is string => typeof value === "string").slice(0, 8),
      sourceRefs: scope.sourceRefs.filter((value): value is string => typeof value === "string").slice(0, 12),
    },
  };
}
export type FounderCommandResult = {
  status: "applied" | "clarify" | "failed";
  text: string;
  refresh: boolean;
};
export async function applyFounderOperation(input: {
  operation: FounderOperation;
  projects: readonly ProjectDeskSummary[];
  people?: readonly ClientSearchResult[];
  jobs: readonly ProjectJob[];
  jobWriter: ProjectJobWriter;
  noteWriter: Pick<ClientMemoryNoteWriter, "addManualNote">;
  actor: string;
  mutationId: string;
  now: Date;
  refresh: () => Promise<void>;
}): Promise<FounderCommandResult> {
  const op = input.operation,
    target = fold(op.target);
  if (op.kind === "clarify")
    return {
      status: "clarify",
      text: op.question,
      refresh: false,
    };
  let matches = input.projects.filter((p) =>
    [
      p.projectId,
      p.title,
      ...p.people.map((person) => person.displayName),
    ].some((label) => {
      const value = fold(label);
      return value === target || value.startsWith(`${target} `);
    }),
  );
  if (matches.length === 0 && op.kind === "correct" && op.scope?.projectId) {
    matches = input.projects.filter((p) => p.projectId === op.scope?.projectId);
  }
  if (matches.length === 0 && op.kind === "correct") {
    matches = input.projects.filter((p) => p.people.some((person) => abbreviatedNameMatch(person.displayName, op.target)));
  }
  const people = (input.people ?? []).filter((person) => {
    const value = fold(person.displayName);
    return value === target || value.startsWith(`${target} `) || abbreviatedNameMatch(person.displayName, op.target);
  });
  const personOnly = op.kind === "correct" && matches.length === 0 && people.length === 1 ? people[0] : null;
  if (matches.length !== 1)
    if (!personOnly)
    return {
      status: "clarify",
      text:
        matches.length > 1
          ? `Which project do you mean: ${matches.map((p) => p.title).join("; ")}?`
          : "Which existing project should I update? Please give its full name or project ID.",
      refresh: false,
    };
  const project = matches[0] ?? null;
  try {
    let success = false;
    if (op.kind === "correct") {
      const scopedOperation = op.scope ? {
        ...op,
        scope: { ...op.scope, projectId: project?.projectId ?? null, personId: personOnly?.personId ?? op.scope.personId },
      } : op;
      const result = await input.noteWriter.addManualNote({
        submissionId: input.mutationId,
        projectId: project?.projectId ?? null,
        personId: personOnly?.personId ?? null,
        contextLayer: "client",
        noteText: correctionNote(scopedOperation),
        actor: input.actor,
      });
      success = result.ok;
    } else {
      if (!project) {
        return { status: "clarify", text: "Which existing project should I update? Please give its full name or project ID.", refresh: false };
      }
      const jobs = input.jobs.filter(
        (j) =>
          j.projectId === project.projectId &&
          (j.state === "open" || j.state === "snoozed"),
      );
      if (jobs.length !== 1)
        return {
          status: "clarify",
          text: jobs.length
            ? `Which work item for ${project.title}: ${jobs.map((j) => j.subject).join("; ")}?`
            : `There is no unresolved canonical work item for ${project.title}.`,
          refresh: false,
        };
      if (
        op.kind === "snooze" &&
        (!op.days || !Number.isInteger(op.days) || op.days < 1 || op.days > 365)
      )
        return {
          status: "clarify",
          text: "How many days should I snooze it (1–365)?",
          refresh: false,
        };
      const result = await input.jobWriter.mutateJob({
        mutationId: input.mutationId,
        projectId: project.projectId,
        jobId: jobs[0].jobId,
        action: op.kind,
        actor: input.actor,
        ...(op.kind === "snooze"
          ? {
              deferredUntil: new Date(
                input.now.getTime() + op.days! * 86400000,
              ).toISOString(),
            }
          : {}),
      });
      success = result.ok;
    }
    if (!success)
      return {
        status: "failed",
        text: "The update failed. No successful change was confirmed.",
        refresh: false,
      };
    try {
      await input.refresh();
    } catch {
      return {
        status: "applied",
        text: "The change was saved, but Today could not refresh. Reload Today before relying on its current display.",
        refresh: true,
      };
    }
    return {
      status: "applied",
      text:
        op.kind === "correct"
          ? `Updated current truth for ${project?.title ?? personOnly?.displayName ?? op.target}: ${op.truth.dependency ?? op.truth.stage}.`
          : `${project.title}: ${op.kind === "snooze" ? `snoozed for ${op.days} days` : op.kind === "resolve" ? "work item resolved" : "work item cancelled"}.`,
      refresh: true,
    };
  } catch {
    return {
      status: "failed",
      text: "The update failed. No successful change was confirmed.",
      refresh: false,
    };
  }
}

function abbreviatedNameMatch(displayName: string, targetName: string): boolean {
  const display = fold(displayName).split(" ").filter(Boolean);
  const target = fold(targetName).split(" ").filter(Boolean);
  if (display.length < 2 || target.length < 2) return false;
  const firstDistance = editDistanceAtMostOne(display[0], target[0]);
  return firstDistance && display.at(-1)?.[0] === target.at(-1)?.[0];
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length > right.length) i++;
    else if (right.length > left.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}
