/**
 * Execute Concierge tools against Continuum. Read + propose only.
 */

import { MONTH_NAMES } from "@/lib/continuum/client-memory/facts/types";
import {
  conciergeClientPath,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { isExactStructuredSpecGmailSource } from "@/lib/continuum/candidates/spec-provenance";
import { gmailEvidenceHrefFromSourceRef } from "@/lib/continuum/chief-of-staff/operating-loop/evidence";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { CurrentProjectOperatingGroup } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import type { ConciergeToolJson, ConciergeToolResult } from "./types";
import { conciergeToolByName } from "./tools";
import { quoteRepairFromContinuum, repairContextCopy } from "./repair";
import { composeSpecFactCopy, fieldLabel, provenanceLabelOf, type SpecFact } from "./provenance";
import type { ConciergeSolWorld } from "./world";
import { CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE } from "./types";

const GMAIL_WEB = "https://mail.google.com/mail/u/0/#all/";

function textArg(args: ConciergeToolJson, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberArg(args: ConciergeToolJson, key: string): number | null {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function failed(name: string, message: string): ConciergeToolResult {
  return { name, ok: false, data: { error: message } };
}

function ok(name: string, data: ConciergeToolJson): ConciergeToolResult {
  return { name, ok: true, data };
}

export async function executeConciergeTool(
  world: ConciergeSolWorld,
  name: string,
  args: ConciergeToolJson,
  now = new Date(),
): Promise<ConciergeToolResult> {
  const def = conciergeToolByName(name);
  if (!def) return failed(name, "unknown-tool");
  if (def.write) return failed(name, CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE);
  try {
    switch (name) {
      case "find_person":
        return ok(name, await findPerson(world, textArg(args, "query")));
      case "get_person_summary":
        return ok(name, await personSummary(world, args));
      case "get_client_history":
        return ok(name, await clientHistory(world, args));
      case "get_birthdays":
        return ok(name, await birthdays(world, args, now));
      case "find_project":
        return ok(name, await findProject(world, textArg(args, "query")));
      case "get_project_summary":
        return ok(name, await projectSummary(world, args));
      case "get_project_specs":
        return ok(name, await projectSpecs(world, args));
      case "get_project_history":
        return ok(name, await projectHistory(world, args));
      case "get_project_jobs":
        return ok(name, await projectJobs(world, args));
      case "get_current_projects":
        return ok(name, await currentProjects(world));
      case "get_waiting_state":
        return ok(name, await waitingState(world, now));
      case "search_gmail_evidence":
        return ok(name, await searchGmail(world, textArg(args, "query")));
      case "get_recent_project_email":
        return ok(name, await recentProjectEmail(world, args));
      case "get_source_evidence":
        return ok(name, await sourceEvidence(world, args));
      case "get_provenance_summary":
        return ok(name, await provenanceSummary(world, args));
      case "get_repair_quote": {
        const quoted = quoteRepairFromContinuum({
          query: textArg(args, "query") || null,
          metal: textArg(args, "metal") || null,
          repairType: textArg(args, "repairType") || null,
          shankMm: numberArg(args, "shankMm"),
          fromSize: numberArg(args, "fromSize"),
          toSize: numberArg(args, "toSize"),
          stoneCount: numberArg(args, "stoneCount"),
        });
        return ok(name, quoted as unknown as ConciergeToolJson);
      }
      case "get_repair_context":
        return ok(name, {
          policy: repairContextCopy(),
          projectId: textArg(args, "projectId") || null,
        });
      case "get_today_items":
        return ok(name, {
          items: await world.loadTodayItems(numberArg(args, "limit") ?? 3),
        });
      case "get_open_commitments":
        return ok(name, await openCommitments(world, now));
      case "get_waiting_on_client":
        return ok(name, await waitingGroup(world, now, "waiting_for_client"));
      case "get_waiting_on_shop":
        return ok(name, await waitingGroup(world, now, "waiting_on_shop"));
      case "get_in_production":
        return ok(name, await waitingGroup(world, now, "in_production"));
      case "search_notes":
        return ok(name, {
          notes: (await world.searchNotes(textArg(args, "query"))).slice(0, 8).map(noteDto),
        });
      case "get_project_notes":
        return ok(name, await projectNotes(world, args));
      case "propose_canonical_change":
        return ok(name, {
          persist: false,
          requiresFounderApproval: true,
          writesCanonical: false,
          kind: textArg(args, "kind") || "change",
          summary: textArg(args, "summary"),
          fieldName: textArg(args, "fieldName") || null,
          proposedValue: textArg(args, "proposedValue") || null,
          message: CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE,
        });
      default:
        return failed(name, "unknown-tool");
    }
  } catch {
    return failed(name, "tool-failed");
  }
}

async function findPerson(world: ConciergeSolWorld, query: string): Promise<ConciergeToolJson> {
  if (!query) return { matches: [], unknown: true };
  const matches = await world.searchPeople(query);
  return {
    matches: matches.slice(0, 5).map((row) => ({
      personId: row.personId,
      displayName: row.displayName,
      organizationName: row.organizationName,
      href: conciergeClientPath(row.personId),
    })),
    unknown: matches.length === 0,
  };
}

async function resolvePersonId(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<string | null> {
  const personId = textArg(args, "personId");
  if (personId) return personId;
  const query = textArg(args, "query");
  if (!query) return null;
  const matches = await world.searchPeople(query);
  return matches[0]?.personId ?? null;
}

async function resolveProjectId(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<string | null> {
  const projectId = textArg(args, "projectId");
  if (projectId) return projectId;
  const query = textArg(args, "query");
  if (!query) return null;
  const found = await findProject(world, query);
  const matches = found.matches as Array<{ projectId: string }> | undefined;
  return matches?.[0]?.projectId ?? null;
}

async function personSummary(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const personId = await resolvePersonId(world, args);
  if (!personId) return { unknown: true };
  const result = await world.getPersonProfile(personId);
  if (!result.ok) return { unknown: true };
  const profile = result.profile;
  return {
    displayName: profile.person.displayName,
    organizationName: profile.person.organizationName,
    href: conciergeClientPath(personId),
    projects: profile.projects.map((row) => ({
      title: row.profile.displayTitle,
      projectId: row.profile.projectId,
      href: conciergeProjectPath(row.profile.projectId),
      fingerSize: row.internalHistory?.fingerSize ?? null,
      metal: row.internalHistory?.metal ?? null,
      cadJobNumber: row.internalHistory?.cadJobNumber ?? null,
      gmailThreadId: row.internalHistory?.gmailThreadId ?? null,
    })),
    noteCount: profile.sourceNotes.length,
    openReviewCount: profile.reviews.openCount,
    pendingSpecs: await pendingSpecsForPerson(world, personId, profile.projects.map((row) => row.profile.projectId)),
  };
}

async function clientHistory(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const summary = await personSummary(world, args);
  if (summary.unknown) return summary;
  const personId = await resolvePersonId(world, args);
  if (!personId) return { unknown: true };
  const result = await world.getPersonProfile(personId);
  if (!result.ok) return { unknown: true };
  return {
    ...summary,
    notes: result.profile.sourceNotes.slice(0, 6).map(noteDto),
  };
}

async function birthdays(
  world: ConciergeSolWorld,
  args: ConciergeToolJson,
  now: Date,
): Promise<ConciergeToolJson> {
  const month = numberArg(args, "month") ?? monthFromQuery(textArg(args, "query"), now);
  if (month == null) return { unknown: true, people: [] };
  const people = await world.listBirthdaysByMonth(month);
  return {
    month,
    monthName: MONTH_NAMES[month - 1] ?? null,
    people: people.map((row) => ({
      displayName: row.displayName,
      month: row.month,
      day: row.day,
      href: conciergeClientPath(row.personId),
    })),
  };
}

function monthFromQuery(query: string, now: Date): number | null {
  const folded = query.toLowerCase();
  const index = MONTH_NAMES.findIndex((name) => folded.includes(name.toLowerCase()));
  if (index >= 0) return index + 1;
  if (folded.includes("next month")) {
    const month = now.getUTCMonth() + 1;
    return month === 12 ? 1 : month + 1;
  }
  return null;
}

async function findProject(world: ConciergeSolWorld, query: string): Promise<ConciergeToolJson> {
  if (!query) return { matches: [], unknown: true };
  const needle = query.toLowerCase();
  const projects = await world.listProjects();
  const matches = projects.filter((row) => {
    const hay = `${row.title} ${row.people.map((person) => person.displayName).join(" ")}`.toLowerCase();
    return needle.split(/\s+/).filter((token) => token.length >= 3).some((token) => hay.includes(token));
  });
  return {
    matches: (matches.length > 0 ? matches : []).slice(0, 6).map((row) => ({
      projectId: row.projectId,
      title: row.title,
      people: row.people.map((person) => person.displayName),
      lifecycleLabel: row.lifecycleLabel,
      href: conciergeProjectPath(row.projectId),
    })),
    unknown: matches.length === 0,
  };
}

async function projectSummary(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const projectId = await resolveProjectId(world, args);
  if (!projectId) return { unknown: true };
  const result = await world.getProjectDesk(projectId);
  if (!result.ok) return { unknown: true };
  const desk = result.desk;
  return {
    title: desk.title,
    href: conciergeProjectPath(projectId),
    people: desk.people.map((row) => row.displayName),
    lifecycleLabel: desk.lifecycle.kind === "none" ? null : desk.lifecycle.label,
    specs: desk.specs.map((row) => ({ label: row.label, value: row.value, fieldName: row.fieldName })),
    jobCount: desk.openJobs.connected ? desk.openJobs.unresolvedCount : 0,
    latestNote: desk.latestNotePreview,
  };
}

async function projectSpecs(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const summary = await projectSummary(world, args);
  return { specs: summary.specs ?? [], unknown: summary.unknown === true, title: summary.title ?? null };
}

async function projectHistory(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const projectId = await resolveProjectId(world, args);
  if (!projectId) return { unknown: true };
  const result = await world.getProjectDesk(projectId);
  if (!result.ok) return { unknown: true };
  return {
    title: result.desk.title,
    corrections: result.desk.specCorrections.slice(0, 8).map((row) => ({
      fieldName: row.fieldName,
      newValue: "newValue" in row ? row.newValue : null,
    })),
    notes: result.desk.notes.slice(0, 6).map((row) => ({
      text: row.noteText,
      createdAt: row.createdAt,
    })),
  };
}

async function projectJobs(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const projectId = await resolveProjectId(world, args);
  if (!projectId) return { unknown: true };
  const result = await world.getProjectDesk(projectId);
  if (!result.ok) return { unknown: true };
  if (!result.desk.openJobs.connected) return { connected: false, jobs: [] };
  return {
    connected: true,
    jobs: result.desk.openJobs.unresolved.slice(0, 8).map((job) => ({
      subject: job.subject,
      waitingOn: job.waitingOnActor,
      dueAt: job.dueAt,
    })),
  };
}

async function currentProjects(world: ConciergeSolWorld): Promise<ConciergeToolJson> {
  const cards = await world.listCurrentProjectCards();
  return {
    projects: cards.slice(0, 12).map((row) => ({
      title: row.title,
      href: row.href,
      currentAction: row.currentAction.label,
      detail: row.currentAction.detail,
    })),
  };
}

async function waitingState(world: ConciergeSolWorld, now: Date): Promise<ConciergeToolJson> {
  const groups = await world.groupCurrentProjects(now.toISOString());
  return {
    groups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      count: group.count,
      titles: group.projects.slice(0, 8).map((row) => row.title),
    })),
  };
}

async function waitingGroup(
  world: ConciergeSolWorld,
  now: Date,
  id: CurrentProjectOperatingGroup["id"],
): Promise<ConciergeToolJson> {
  const groups = await world.groupCurrentProjects(now.toISOString());
  const group = groups.find((row) => row.id === id);
  return {
    id,
    label: group?.label ?? id,
    projects: (group?.projects ?? []).map((row) => ({
      title: row.title,
      href: row.href,
      detail: row.currentAction.detail,
    })),
  };
}

async function openCommitments(world: ConciergeSolWorld, now: Date): Promise<ConciergeToolJson> {
  const groups = await world.groupCurrentProjects(now.toISOString());
  const yours = groups.find((row) => row.id === "your_turn");
  return {
    projects: (yours?.projects ?? []).map((row) => ({
      title: row.title,
      href: row.href,
      detail: row.currentAction.detail,
    })),
  };
}

async function searchGmail(world: ConciergeSolWorld, query: string): Promise<ConciergeToolJson> {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  const rows = await world.searchGmailSubjects(tokens.slice(0, 6));
  return {
    messages: rows.slice(0, 6).map((row) => ({
      subject: row.subject,
      sentAt: row.sentAt,
      direction: row.direction,
      href: `${GMAIL_WEB}${encodeURIComponent(row.threadId)}/${encodeURIComponent(row.messageId)}`,
    })),
  };
}

async function recentProjectEmail(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const summary = await personOrProjectThread(world, args);
  if (!summary.threadId) return { unknown: true, missingThread: true };
  const listed = await world.listGmailByThread(summary.threadId);
  listed.sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const latest = listed[listed.length - 1] ?? null;
  const fetched = await world.fetchProjectEmail({
    threadId: summary.threadId,
    messageId: latest?.messageId ?? null,
  });
  const href = latest
    ? `${GMAIL_WEB}${encodeURIComponent(latest.threadId)}/${encodeURIComponent(latest.messageId)}`
    : `${GMAIL_WEB}${encodeURIComponent(summary.threadId)}`;
  return {
    projectTitle: summary.title,
    subject: fetched?.subject ?? latest?.subject ?? null,
    sentAt: fetched?.sentAt ?? latest?.sentAt ?? null,
    snippet: fetched?.snippet ?? null,
    href: fetched?.href ?? href,
  };
}

async function personOrProjectThread(
  world: ConciergeSolWorld,
  args: ConciergeToolJson,
): Promise<{ threadId: string | null; title: string | null }> {
  const projectId = await resolveProjectId(world, args);
  if (projectId) {
    const desk = await world.getProjectDesk(projectId);
    if (desk.ok) {
      const thread = desk.desk.specs.length >= 0
        ? (await threadFromDesk(world, projectId))
        : null;
      return { threadId: thread, title: desk.desk.title };
    }
  }
  const personId = await resolvePersonId(world, args);
  if (!personId) return { threadId: null, title: null };
  const profile = await world.getPersonProfile(personId);
  if (!profile.ok) return { threadId: null, title: null };
  const project = profile.profile.projects[0];
  return {
    threadId: project?.internalHistory?.gmailThreadId ?? null,
    title: project?.profile.displayTitle ?? null,
  };
}

async function threadFromDesk(world: ConciergeSolWorld, projectId: string): Promise<string | null> {
  const desk = await world.getProjectDesk(projectId);
  if (!desk.ok) return null;
  const summary = (await world.listProjects()).find((row) => row.projectId === projectId);
  return summary?.gmailThreadId ?? null;
}

async function sourceEvidence(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const facts = await collectSpecFacts(world, args);
  const fact = facts[0] ?? null;
  return {
    facts,
    href: fact?.sourceHref ?? null,
    sourceVerified: fact?.sourceVerified ?? false,
    provenance: fact?.provenance ?? "unknown",
  };
}

async function provenanceSummary(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const facts = await collectSpecFacts(world, args);
  return {
    facts: facts.map((fact) => ({
      ...fact,
      copy: composeSpecFactCopy(fact),
    })),
  };
}

async function collectSpecFacts(
  world: ConciergeSolWorld,
  args: ConciergeToolJson,
): Promise<SpecFact[]> {
  const fieldName = textArg(args, "fieldName") || "finger_size";
  const projectId = await resolveProjectId(world, args);
  const personId = await resolvePersonId(world, args);
  const candidates = await world.listCandidates();
  const desks: Array<{ projectId: string; title: string; specs: { fieldName: string; value: string; label: string }[] }> = [];
  if (projectId) {
    const desk = await world.getProjectDesk(projectId);
    if (desk.ok) {
      desks.push({
        projectId,
        title: desk.desk.title,
        specs: desk.desk.specs,
      });
    }
  } else if (personId) {
    const profile = await world.getPersonProfile(personId);
    if (profile.ok) {
      for (const project of profile.profile.projects) {
        const desk = await world.getProjectDesk(project.profile.projectId);
        if (desk.ok) {
          desks.push({
            projectId: project.profile.projectId,
            title: desk.desk.title,
            specs: desk.desk.specs,
          });
        } else if (project.internalHistory) {
          desks.push({
            projectId: project.profile.projectId,
            title: project.profile.displayTitle,
            specs: project.internalHistory.fingerSize
              ? [{ fieldName: "finger_size", value: project.internalHistory.fingerSize, label: "Finger size" }]
              : [],
          });
        }
      }
    }
  }

  const facts: SpecFact[] = [];
  for (const desk of desks) {
    const canonical = desk.specs.find((row) => row.fieldName === fieldName)?.value ?? null;
    const related = candidates.filter((row) => candidateMatches(row, desk.projectId, fieldName));
    if (related.length === 0 && canonical) {
      facts.push({
        fieldName,
        label: fieldLabel(fieldName),
        canonicalValue: canonical,
        proposedValue: null,
        conflict: false,
        provenance: "canonical",
        sourceVerified: true,
        sourceHref: null,
        matchedText: null,
      });
      continue;
    }
    for (const row of related) {
      const payload = row.payload.kind === "structured_spec" ? row.payload : null;
      if (!payload) continue;
      const exact = isExactStructuredSpecGmailSource(row);
      const href = gmailEvidenceHrefFromSourceRef(row.sourceRef);
      facts.push({
        fieldName,
        label: fieldLabel(fieldName),
        canonicalValue: canonical,
        proposedValue: payload.proposedValue,
        conflict: Boolean(payload.conflict || (canonical && payload.proposedValue !== canonical)),
        provenance: provenanceLabelOf({
          canonicalValue: canonical,
          proposedValue: payload.proposedValue,
          sourceProvenance: payload.sourceProvenance,
          exactGmail: exact,
        }),
        sourceVerified: exact && Boolean(href),
        sourceHref: exact ? href : null,
        matchedText: row.evidenceBasis.matchedText,
      });
    }
    if (related.length === 0 && !canonical) {
      facts.push({
        fieldName,
        label: fieldLabel(fieldName),
        canonicalValue: null,
        proposedValue: null,
        conflict: false,
        provenance: "unknown",
        sourceVerified: false,
        sourceHref: null,
        matchedText: null,
      });
    }
  }
  return facts;
}

function candidateMatches(
  row: ContinuumCandidate,
  projectId: string,
  fieldName: string,
): boolean {
  if (row.payload.kind !== "structured_spec") return false;
  if (row.payload.fieldName !== fieldName) return false;
  if (row.reviewStatus === "discarded") return false;
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "project_spec" || target.kind === "project") {
    return target.projectId === projectId;
  }
  return false;
}

async function pendingSpecsForPerson(
  world: ConciergeSolWorld,
  _personId: string,
  projectIds: readonly string[],
): Promise<Array<{ fieldName: string; proposedValue: string; canonicalValue: string | null; provenance: string }>> {
  if (projectIds.length === 0) return [];
  const candidates = await world.listCandidates();
  const pending: Array<{
    fieldName: string;
    proposedValue: string;
    canonicalValue: string | null;
    provenance: string;
  }> = [];
  for (const projectId of projectIds) {
    const desk = await world.getProjectDesk(projectId);
    const specs = desk.ok ? desk.desk.specs : [];
    for (const row of candidates) {
      const payload = row.payload;
      if (payload.kind !== "structured_spec") continue;
      if (!candidateMatches(row, projectId, payload.fieldName)) continue;
      const canonical = specs.find((spec) => spec.fieldName === payload.fieldName)?.value ?? null;
      pending.push({
        fieldName: payload.fieldName,
        proposedValue: payload.proposedValue,
        canonicalValue: canonical,
        provenance: payload.sourceProvenance ?? "UNKNOWN",
      });
    }
  }
  return pending.slice(0, 6);
}

async function projectNotes(world: ConciergeSolWorld, args: ConciergeToolJson): Promise<ConciergeToolJson> {
  const projectId = await resolveProjectId(world, args);
  if (!projectId) return { unknown: true, notes: [] };
  const desk = await world.getProjectDesk(projectId);
  if (!desk.ok) return { unknown: true, notes: [] };
  return {
    title: desk.desk.title,
    notes: desk.desk.notes.slice(0, 8).map((row) => ({
      text: row.noteText,
      createdAt: row.createdAt,
    })),
  };
}

function noteDto(row: { noteText: string; createdAt: string; contextLayer?: string | null }) {
  return {
    text: row.noteText,
    createdAt: row.createdAt,
    contextLayer: row.contextLayer ?? null,
  };
}

export function gmailHrefForIndexed(threadId: string, messageId?: string | null): string {
  const parsed = parseGmailCandidateSourceRef(`gc1|${threadId}|${messageId ?? threadId}|x`);
  if (parsed) {
    return `${GMAIL_WEB}${encodeURIComponent(parsed.threadId)}${
      messageId ? `/${encodeURIComponent(messageId)}` : ""
    }`;
  }
  return `${GMAIL_WEB}${encodeURIComponent(threadId)}`;
}
