import { createHash, randomUUID } from "node:crypto";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import type { TodayGmailThreadContext, TodayKnownPerson } from "@/lib/continuum/candidates/founder-attention";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import type { TodayUpcomingItem } from "@/lib/continuum/calendar/today-upcoming";
import { strictProjectNumbers } from "@/lib/continuum/project-evidence/discover";
import {
  STERLING_TODAY_WORKING_SET_VERSION,
  type SterlingEvidence,
  type SterlingRelationshipRole,
  type SterlingResponsibleParty,
  type SterlingTodayWorkingSet,
  type SterlingPreviousTodayItem,
} from "./types";

export type BuildSterlingTodayWorkingSetInput = {
  runId?: string;
  sourceWatermark: string;
  generatedAt: string;
  projects: readonly ProjectDeskSummary[];
  jobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  threadContext: ReadonlyMap<string, TodayGmailThreadContext>;
  projectThreadIds?: ReadonlyMap<string, readonly string[]>;
  knownPeople: readonly TodayKnownPerson[];
  founderCorrections?: readonly SourceCommunicationEvent[];
  calendar?: readonly TodayUpcomingItem[];
  calendarAvailability?: SterlingTodayWorkingSet["calendarAvailability"];
  previousToday?: readonly SterlingPreviousTodayItem[];
};

function relationshipRole(roles: readonly string[] | undefined): SterlingRelationshipRole {
  if (roles?.includes("vendor-contact") || roles?.includes("vendor")) return "vendor_shop";
  if (roles?.includes("client")) return "client";
  if (roles?.includes("prospect")) return "prospect";
  if (roles?.includes("salesperson")) return "salesperson_solicitation";
  if (roles?.includes("system")) return "system_automation";
  if (roles?.includes("business-contact")) return "business_contact";
  return "unknown";
}

function responsibleParty(actor: ProjectJob["waitingOnActor"]): SterlingResponsibleParty {
  if (actor === "founder" || actor === "hourglass") return "founder";
  if (actor === "client") return "client";
  if (actor === "vendor") return "vendor_shop";
  return "unknown";
}

function targetProjectId(candidate: ContinuumCandidate): string | null {
  const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
  return "projectId" in target ? target.projectId : null;
}

function candidateExcerpt(candidate: ContinuumCandidate): string | null {
  const matched = candidate.evidenceBasis.matchedText?.trim() ?? "";
  if (matched) return matched.slice(0, 2400);
  const payload = candidate.founderEditedPayload ?? candidate.payload;
  if (payload.kind === "note") return payload.text.slice(0, 2400);
  if (payload.kind === "follow_up") return payload.text.slice(0, 2400);
  if (payload.kind === "project_context") return `${payload.topic}: ${payload.value}`.slice(0, 2400);
  if (payload.kind === "open_job") return [payload.subject, payload.detail].filter(Boolean).join(" — ").slice(0, 2400);
  return null;
}

function cleanExcerpt(value: string | null | undefined): string | null {
  const clean = (value ?? "").split("\n").filter(line => !/^\s*>/.test(line) && !/\bwrote:\s*$/i.test(line))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean ? clean.slice(0, 4000) : null;
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map(v => v?.trim() ?? "").filter(Boolean))];
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSterlingTodayWorkingSet(input: BuildSterlingTodayWorkingSetInput): SterlingTodayWorkingSet {
  const knownByHash = new Map(input.knownPeople.map(person => [person.emailHash.toLowerCase(), person.personId]));
  const peopleById = new Map<string, typeof input.knownPeople[number][]>()
  for (const person of input.knownPeople) peopleById.set(person.personId, [...(peopleById.get(person.personId) ?? []), person]);

  const projectIdsByThread = new Map<string, Set<string>>();
  const addThreadProject = (threadId: string | null | undefined, projectId: string | null | undefined) => {
    if (!threadId?.trim() || !projectId?.trim()) return;
    const set = projectIdsByThread.get(threadId) ?? new Set<string>(); set.add(projectId); projectIdsByThread.set(threadId, set);
  };
  for (const project of input.projects) addThreadProject(project.gmailThreadId, project.projectId);
  for (const [projectId, threadIds] of input.projectThreadIds ?? []) {
    for (const threadId of threadIds) addThreadProject(threadId, projectId);
  }
  for (const candidate of input.candidates) {
    const projectId = targetProjectId(candidate);
    for (const threadId of collectExactGmailIds([candidate]).threadIds) addThreadProject(threadId, projectId);
  }

  // Exact CAD/order/production identifiers are identity resolution, not semantic judgment.
  const projectsByIdentifier = new Map<string, Set<string>>();
  for (const project of input.projects) {
    const values = [project.title, ...(project.specs ?? []).map(spec => spec.value)];
    for (const token of strictProjectNumbers(values.join(" "))) {
      const ids = projectsByIdentifier.get(token) ?? new Set<string>(); ids.add(project.projectId); projectsByIdentifier.set(token, ids);
    }
  }
  for (const [threadId, thread] of input.threadContext) {
    const haystack = [thread.subject, ...(thread.attachmentFilenames ?? []), ...(thread.messages ?? []).flatMap(message => [
      message.subject, message.operationalText, ...(message.attachmentFilenames ?? []),
    ])].filter(Boolean).join(" ");
    const identifierProjectIds = new Set(strictProjectNumbers(haystack)
      .flatMap(token => [...(projectsByIdentifier.get(token) ?? [])]));
    if (identifierProjectIds.size === 1) addThreadProject(threadId, [...identifierProjectIds][0]);
  }

  const candidatesByMessage = new Map<string, ContinuumCandidate[]>();
  for (const candidate of input.candidates) for (const messageId of collectExactGmailIds([candidate]).messageIds) {
    candidatesByMessage.set(messageId, [...(candidatesByMessage.get(messageId) ?? []), candidate]);
  }

  const evidence: SterlingEvidence[] = [];
  for (const [threadId, thread] of input.threadContext) {
    const projectIds = [...(projectIdsByThread.get(threadId) ?? [])];
    for (const message of thread.messages ?? []) {
      const related = candidatesByMessage.get(message.messageId) ?? [];
      const excerpt = cleanExcerpt(message.operationalText) ?? cleanExcerpt(related.map(candidateExcerpt).filter(Boolean).join("\n"));
      evidence.push({
        evidenceId: `gmail:${threadId}:${message.messageId}`, sourceType: "gmail",
        sourceRef: `gmail:thread:${threadId}:message:${message.messageId}`, timestamp: message.sentAt,
        direction: message.direction, subject: message.subject ?? thread.subject ?? null, excerpt,
        attachmentFilenames: unique(message.attachmentFilenames ?? []), messageId: message.messageId, threadId,
        projectIds: unique([...projectIds, ...related.map(targetProjectId)]),
        personIds: unique([knownByHash.get(message.fromEmailHash?.toLowerCase() ?? "")]),
        provenance: message.operationalText ? "indexed_gmail+live_quote_stripped_current_message" : "indexed_gmail+candidate_excerpt",
      });
    }
  }
  for (const candidate of input.candidates) {
    const ids = collectExactGmailIds([candidate]);
    if (ids.messageIds.some(id => candidatesByMessage.has(id) && evidence.some(row => row.messageId === id))) continue;
    const excerpt = cleanExcerpt(candidateExcerpt(candidate));
    if (!excerpt) continue;
    evidence.push({ evidenceId: `candidate:${candidate.candidateId}`, sourceType: "candidate", sourceRef: candidate.sourceRef,
      timestamp: candidate.sourceTimestamp, direction: "unknown", subject: null, excerpt, attachmentFilenames: [],
      messageId: ids.messageIds[0] ?? null, threadId: ids.threadIds[0] ?? null,
      projectIds: unique([targetProjectId(candidate)]), personIds: [], provenance: `candidate:${candidate.parserVersion}` });
  }
  for (const correction of input.founderCorrections ?? []) {
    evidence.push({ evidenceId: `founder:${digest([correction.sourceRef, correction.timestamp]).slice(0, 20)}`,
      sourceType: "founder_directive", sourceRef: correction.sourceRef, timestamp: correction.timestamp,
      direction: correction.direction, subject: correction.subject, excerpt: cleanExcerpt(correction.authorOwnedText || correction.evidenceExcerpt),
      attachmentFilenames: [...correction.attachmentFilenames], messageId: correction.messageId, threadId: correction.threadId,
      projectIds: unique([correction.projectId]), personIds: [], provenance: "founder_correction" });
  }
  for (const item of input.calendar ?? []) {
    evidence.push({ evidenceId: `calendar:${item.sourceRef}`, sourceType: "calendar", sourceRef: item.sourceRef,
      timestamp: item.observedAt ?? input.generatedAt, direction: "unknown", subject: item.title, excerpt: item.location,
      attachmentFilenames: [], messageId: null, threadId: null, projectIds: [], personIds: [], provenance: "calendar_read_only" });
  }
  for (const project of input.projects) {
    evidence.push({ evidenceId: `canonical:project:${project.projectId}`, sourceType: "canonical",
      sourceRef: `continuum:project:${project.projectId}`, timestamp: project.latestNoteAt ?? project.recordCreatedAt ?? input.generatedAt,
      direction: "unknown", subject: project.title,
      excerpt: `Canonical project; lifecycle=${project.lifecycleStage ?? "unknown"}; kind=${project.projectKind ?? "unknown"}.`,
      attachmentFilenames: [], messageId: null, threadId: null, projectIds: [project.projectId],
      personIds: project.people.map(person => person.personId), provenance: "canonical_project_read_only" });
  }
  for (const job of input.jobs) {
    evidence.push({ evidenceId: `canonical:job:${job.jobId}`, sourceType: "canonical",
      sourceRef: `continuum:job:${job.jobId}`, timestamp: job.updatedAt,
      direction: "unknown", subject: job.subject,
      excerpt: `Canonical job; state=${job.state}; waitingOn=${job.waitingOnActor ?? "unknown"}.`,
      attachmentFilenames: [], messageId: null, threadId: null, projectIds: unique([job.projectId]),
      personIds: unique([job.associatedPersonId]), provenance: "canonical_job_read_only" });
  }
  evidence.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.evidenceId.localeCompare(b.evidenceId));

  const jobsByProject = new Map<string, ProjectJob[]>();
  for (const job of input.jobs) if (job.projectId) jobsByProject.set(job.projectId, [...(jobsByProject.get(job.projectId) ?? []), job]);
  const projects = input.projects.map(project => ({
    projectId: project.projectId, title: project.title, projectKind: project.projectKind,
    lifecycleStage: project.lifecycleStage,
    recordVersion: digest([project.projectId, project.recordCreatedAt, project.latestNoteAt, project.lifecycleStage]),
    people: project.people.map(person => ({ personId: person.personId, relationshipRole: relationshipRole(person.roles) })),
    specs: (project.specs ?? []).map(spec => ({ fieldName: spec.fieldName, value: spec.value })),
    openJobIds: (jobsByProject.get(project.projectId) ?? []).filter(job => job.state === "open" || job.state === "snoozed").map(job => job.jobId),
    gmailThreadIds: unique([project.gmailThreadId, ...[...projectIdsByThread].filter(([, ids]) => ids.has(project.projectId)).map(([id]) => id)]),
  }));
  const people = [...peopleById].map(([personId, rows]) => ({ personId, displayName: rows[0]!.displayName,
    roles: unique(rows.flatMap(row => row.roles ?? [])), organizationName: rows.find(row => row.organizationName)?.organizationName ?? null,
    emailHashes: unique(rows.map(row => row.emailHash)) }));
  const jobs = input.jobs.map(job => ({ jobId: job.jobId, projectId: job.projectId,
    associatedPersonId: job.associatedPersonId, kind: job.kind, subject: job.subject, detail: job.detail,
    responsibleParty: responsibleParty(job.waitingOnActor), state: job.state, dueAt: job.dueAt,
    deferredUntil: job.deferredUntil, sourceRef: job.sourceRef, recordVersion: job.updatedAt }));
  const calendar = (input.calendar ?? []).map(item => ({ evidenceId: `calendar:${item.sourceRef}`,
    sourceRef: item.sourceRef, timeLabel: item.timeLabel, title: item.title, location: item.location,
    allDay: item.allDay, disclosure: item.disclosure }));
  const calendarAvailability = input.calendarAvailability ?? {
    status: "unavailable" as const,
    reason: "calendar-availability-not-supplied",
  };
  const workUnits = buildWorkUnits(projects, evidence);
  const snapshotMaterial = { sourceWatermark: input.sourceWatermark, projects, jobs, evidence, workUnits,
    calendarAvailability, calendar, previousToday: input.previousToday ?? [] };
  return { contractVersion: STERLING_TODAY_WORKING_SET_VERSION, runId: input.runId ?? randomUUID(),
    evidenceSnapshotId: digest(snapshotMaterial), sourceWatermark: input.sourceWatermark, generatedAt: input.generatedAt,
    mutationMode: "shadow_read_only", people, projects, jobs, evidence, workUnits,
    calendarAvailability, calendar, previousToday: input.previousToday ?? [] };
}

function buildWorkUnits(
  projects: SterlingTodayWorkingSet["projects"],
  evidence: readonly SterlingEvidence[],
): SterlingTodayWorkingSet["workUnits"] {
  const canonical = projects.map(project => {
    const rows = evidence.filter(row => row.projectIds.includes(project.projectId));
    return {
      workUnitId: `project:${project.projectId}`,
      kind: "canonical_project" as const,
      identityBasis: "canonical_project" as const,
      projectId: project.projectId,
      label: project.title,
      observedIdentifiers: strictProjectNumbers([project.title, ...project.specs.map(spec => spec.value)].join(" ")),
      threadIds: unique([...(project.gmailThreadIds ?? []), ...rows.map(row => row.threadId)]),
      sourceRefs: unique(rows.map(row => row.sourceRef)),
      evidenceRefs: unique(rows.map(row => row.evidenceId)),
    };
  });

  type ProvisionalGroup = {
    key: string; identityBasis: "exact_identifier" | "source_thread" | "source_record"; label: string;
    identifiers: string[]; threadIds: string[]; sourceRefs: string[]; evidenceRefs: string[];
  };
  const evidenceBySource = new Map<string, SterlingEvidence[]>();
  for (const row of evidence) {
    if (row.projectIds.length > 0 || row.sourceType === "canonical" || row.sourceType === "calendar") continue;
    const key = row.threadId ? `thread:${row.threadId}` : `source:${row.sourceRef}`;
    evidenceBySource.set(key, [...(evidenceBySource.get(key) ?? []), row]);
  }
  const provisional = new Map<string, ProvisionalGroup>();
  for (const [sourceKey, rows] of evidenceBySource) {
    const identifiers = unique(rows.flatMap(row => strictProjectNumbers(
      [row.subject, row.excerpt, ...row.attachmentFilenames].filter(Boolean).join(" "))));
    const first = rows[0]!;
    const identityBasis = identifiers.length === 1 ? "exact_identifier" as const
      : first.threadId ? "source_thread" as const : "source_record" as const;
    const sourceIdentity = identifiers.length === 1 ? identifiers[0]! : sourceKey;
    const key = `${identityBasis}:${sourceIdentity}`;
    const current = provisional.get(key) ?? { key, identityBasis,
      label: identifiers[0] ?? first.subject ?? "Provisional evidence-backed work",
      identifiers: [], threadIds: [], sourceRefs: [], evidenceRefs: [] };
    current.identifiers = unique([...current.identifiers, ...identifiers]);
    current.threadIds = unique([...current.threadIds, ...rows.map(row => row.threadId)]);
    current.sourceRefs = unique([...current.sourceRefs, ...rows.map(row => row.sourceRef)]);
    current.evidenceRefs = unique([...current.evidenceRefs, ...rows.map(row => row.evidenceId)]);
    provisional.set(key, current);
  }
  const provisionalUnits = [...provisional.values()].map(group => ({
    workUnitId: `provisional:${digest(group.key).slice(0, 24)}`,
    kind: "provisional_evidence" as const,
    identityBasis: group.identityBasis,
    projectId: null,
    label: group.label,
    observedIdentifiers: group.identifiers,
    threadIds: group.threadIds,
    sourceRefs: group.sourceRefs,
    evidenceRefs: group.evidenceRefs,
  }));
  return [...canonical, ...provisionalUnits].sort((a, b) => a.workUnitId.localeCompare(b.workUnitId));
}
