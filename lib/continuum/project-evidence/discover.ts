/**
 * Deterministic project-evidence discovery.
 * Thread is the Gmail unit. A thread is eligible only when its exact
 * project numbers agree. Subject text alone and display names alone are not.
 * No model. No writes. No Person or Project minting.
 */

import { createHash } from "node:crypto";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { parseHgdClientLabel } from "@/lib/continuum/candidates/work-loop-identity";
import { meaningfulAttachmentNames, safeFounderCopy } from "@/lib/continuum/project-book/admit";
import type {
  DiscoveredProjectEvidence,
  ProjectEvidenceBasis,
  ProjectEvidenceBasisFlag,
  ProjectEvidenceCatalogProject,
  ProjectEvidenceReview,
  ProjectEvidenceReviewItem,
  ProjectEvidenceTarget,
  ProjectEvidenceThread,
  ReviewedProjectEvidence,
} from "./types";
import { PROJECT_EVIDENCE_THREAD_LIMIT } from "./types";

const STRICT_NUMBER = /(?<![A-Za-z0-9])(C\d{5,}|SP\d{4,}|RN\d{4,})(?![A-Za-z0-9])/gi;
const CAD_NUMBER = /^C\d{5,}$/;

export function projectEvidenceReviewKey(projectId: string, threadId: string): string {
  return createHash("sha256")
    .update(`continuum-project-evidence:v1\0${projectId}\0${threadId}`)
    .digest("hex");
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = value.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

export function strictProjectNumbers(text: string): string[] {
  return unique([...(text.match(STRICT_NUMBER) ?? [])].map((token) => token.toUpperCase()));
}

function projectNeedles(project: {
  cadJobNumber: string | null;
  orderNumber: string | null;
}): string[] {
  return unique(
    [project.cadJobNumber ?? "", project.orderNumber ?? ""].flatMap((value) =>
      strictProjectNumbers(value),
    ),
  );
}

function normalizedLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function flagsOf(flags: readonly ProjectEvidenceBasisFlag[]): ProjectEvidenceBasisFlag[] {
  return unique(flags).filter((flag): flag is ProjectEvidenceBasisFlag =>
    (
      [
        "exact_stored_gmail_thread",
        "founder_approval",
        "founder_rejection",
        "exact_attachment_project_number",
        "known_person_commercial",
        "conflicting_project_numbers",
        "multiple_projects",
        "unresolved_identity",
      ] as const
    ).includes(flag as ProjectEvidenceBasisFlag),
  );
}

function basis(input: {
  flags: readonly ProjectEvidenceBasisFlag[];
  projectNumbers?: readonly string[];
  conflictingProjectNumbers?: readonly string[];
  attachmentNames?: readonly string[];
}): ProjectEvidenceBasis {
  return {
    flags: flagsOf(input.flags),
    projectNumbers: unique(input.projectNumbers ?? []),
    conflictingProjectNumbers: unique(input.conflictingProjectNumbers ?? []),
    attachmentNames: meaningfulAttachmentNames(input.attachmentNames ?? []).slice(0, 8),
  };
}

function cadTokens(numbers: readonly string[]): string[] {
  return numbers.filter((token) => CAD_NUMBER.test(token));
}

function canonicalThread(threadId: string): string | null {
  const coerced = coerceGmailThreadId(threadId);
  return coerced.status === "canonical" ? coerced.value : null;
}

function judgment(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function unresolved(project: ProjectEvidenceTarget): boolean {
  const mark = judgment(project.matchJudgment);
  return (
    project.distrust ||
    mark === "ambiguous" ||
    mark === "no-exact" ||
    mark === "malformed-source-value"
  );
}

function exactStored(project: ProjectEvidenceTarget): boolean {
  const mark = judgment(project.matchJudgment);
  return (mark === "exact" || mark === "") && !unresolved(project);
}

function catalogLabel(
  project: ProjectEvidenceCatalogProject | undefined,
  number: string,
): string {
  const title = (project?.label ?? "").replace(/\s+/g, " ").trim();
  if (!title || /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(title)) return number;
  return `${title} · ${number}`;
}

function ownersOf(
  number: string,
  catalog: readonly ProjectEvidenceCatalogProject[],
): ProjectEvidenceCatalogProject[] {
  return catalog.filter((project) => projectNeedles(project).includes(number));
}

function knownPersonCommercial(
  project: ProjectEvidenceTarget,
  subjects: readonly string[],
  needles: readonly string[],
): boolean {
  if (needles.length === 0 || project.linkedPersonLabels.length === 0) return false;
  const linked = new Set(project.linkedPersonLabels.map(normalizedLabel).filter(Boolean));
  for (const subject of subjects) {
    const parsed = parseHgdClientLabel(subject);
    if (!parsed) continue;
    if (!needles.includes(parsed.cadId.toUpperCase())) continue;
    if (linked.has(normalizedLabel(parsed.name))) return true;
  }
  return false;
}

function safeSubject(subjects: readonly string[]): string | null {
  for (const subject of subjects) {
    const safe = safeFounderCopy(subject);
    if (safe) return safe;
  }
  return null;
}

function reasonFor(input: {
  status: DiscoveredProjectEvidence["status"];
  basis: ProjectEvidenceBasis;
}): string {
  if (input.basis.flags.includes("conflicting_project_numbers")) {
    const numbers = input.basis.conflictingProjectNumbers.join(" and ");
    return numbers
      ? `This thread contains ${numbers}. No project is selected automatically.`
      : "This thread points at more than one project number.";
  }
  if (input.basis.flags.includes("multiple_projects")) {
    return "More than one project already claims this thread.";
  }
  if (input.basis.flags.includes("unresolved_identity")) {
    return "This project is unresolved, so the thread stays in review.";
  }
  if (input.basis.flags.includes("exact_attachment_project_number")) {
    const number = input.basis.projectNumbers[0];
    return number
      ? `A shop file on this thread contains ${number}.`
      : "A shop file contains this project's number.";
  }
  if (input.basis.flags.includes("known_person_commercial")) {
    return "A linked person and this project's number appear together on the shop thread.";
  }
  if (input.status === "trusted" && input.basis.flags.includes("exact_stored_gmail_thread")) {
    return "This thread is the project's stored exact Gmail thread.";
  }
  return "Possible project evidence.";
}

function discovered(input: {
  project: ProjectEvidenceTarget;
  thread: ProjectEvidenceThread;
  status: DiscoveredProjectEvidence["status"];
  evidenceBasis: ProjectEvidenceBasis;
  possibleMatches: readonly string[];
}): DiscoveredProjectEvidence {
  const threadId = canonicalThread(input.thread.threadId) ?? input.thread.threadId.trim();
  return {
    projectId: input.project.projectId,
    sourceType: "gmail",
    sourceIdentity: threadId,
    sourceThreadId: threadId,
    status: input.status,
    basis: input.evidenceBasis,
    earliest: input.thread.earliest,
    latest: input.thread.latest,
    subject: safeSubject(input.thread.subjects),
    attachmentNames: input.evidenceBasis.attachmentNames,
    reason: reasonFor({ status: input.status, basis: input.evidenceBasis }),
    possibleMatches: input.possibleMatches,
  };
}

export function discoverProjectEvidence(input: {
  project: ProjectEvidenceTarget;
  catalog: readonly ProjectEvidenceCatalogProject[];
  threads: readonly ProjectEvidenceThread[];
  /** Null means the claimant lookup failed. Stored threads are not trusted. */
  claimantProjectIds?: readonly string[] | null;
}): DiscoveredProjectEvidence[] {
  const projectId = input.project.projectId.trim();
  const needles = projectNeedles(input.project);
  const stored = input.project.storedThreadId
    ? canonicalThread(input.project.storedThreadId)
    : null;
  const claimants = input.claimantProjectIds == null ? null : unique(input.claimantProjectIds);
  const rows: DiscoveredProjectEvidence[] = [];
  const seen = new Set<string>();

  const remember = (row: DiscoveredProjectEvidence | null) => {
    if (!row || seen.has(row.sourceIdentity)) return;
    seen.add(row.sourceIdentity);
    rows.push(row);
  };

  if (stored && exactStored(input.project) && claimants) {
    const soleClaimant = claimants.length === 1 && claimants[0] === projectId;
    const thread =
      input.threads.find((item) => canonicalThread(item.threadId) === stored) ?? {
        threadId: stored,
        subjects: [],
        attachmentFilenames: [],
        earliest: null,
        latest: null,
      };
    const storedFileCads = cadTokens(
      unique(meaningfulAttachmentNames(thread.attachmentFilenames).flatMap(strictProjectNumbers)),
    );
    const storedConflict = storedFileCads.filter((token) => !needles.includes(token));
    if (storedFileCads.length > 1 || storedConflict.length > 0) {
      remember(
        discovered({
          project: input.project,
          thread,
          status: "ambiguous",
          evidenceBasis: basis({
            flags: ["conflicting_project_numbers"],
            projectNumbers: needles,
            conflictingProjectNumbers: unique([...storedFileCads, ...needles]),
            attachmentNames: thread.attachmentFilenames,
          }),
          possibleMatches: unique(
            storedFileCads.flatMap((number) => {
              const owners = ownersOf(number, input.catalog);
              return owners.length ? owners.map((owner) => catalogLabel(owner, number)) : [number];
            }),
          ),
        }),
      );
    } else if (soleClaimant) {
      remember(
        discovered({
          project: input.project,
          thread,
          status: "trusted",
          evidenceBasis: basis({
            flags: ["exact_stored_gmail_thread"],
            projectNumbers: needles,
            attachmentNames: thread.attachmentFilenames,
          }),
          possibleMatches: [],
        }),
      );
    } else {
      remember(
        discovered({
          project: input.project,
          thread,
          status: "ambiguous",
          evidenceBasis: basis({
            flags: ["multiple_projects"],
            projectNumbers: needles,
            attachmentNames: thread.attachmentFilenames,
          }),
          possibleMatches: claimants.map((id) => {
            const owner = input.catalog.find((item) => item.projectId === id);
            return owner ? catalogLabel(owner, projectNeedles(owner)[0] ?? "project") : "Another project";
          }),
        }),
      );
    }
  }

  for (const thread of input.threads) {
    const threadId = canonicalThread(thread.threadId);
    if (!threadId || seen.has(threadId)) continue;
    const files = meaningfulAttachmentNames(thread.attachmentFilenames);
    const fileNumbers = unique(files.flatMap(strictProjectNumbers));
    const subjectNumbers = unique(thread.subjects.flatMap(strictProjectNumbers));
    const fileCads = cadTokens(fileNumbers);
    const subjectCads = cadTokens(subjectNumbers);
    const foreignCads = unique([...fileCads, ...subjectCads]).filter((token) => !needles.includes(token));
    const matchesProject = fileNumbers.some((token) => needles.includes(token));
    const personCommercial =
      !matchesProject &&
      knownPersonCommercial(input.project, thread.subjects, needles) &&
      foreignCads.length === 0;
    const conflict = fileCads.length > 1 || (matchesProject && foreignCads.length > 0);
    if (!matchesProject && !personCommercial && !conflict) continue;
    if (needles.length === 0 && !conflict) continue;

    const involved = unique([
      ...fileCads.filter((token) => needles.includes(token) || conflict),
      ...foreignCads,
    ]);
    const possibleMatches = unique(
      involved.flatMap((number) => {
        const owners = ownersOf(number, input.catalog);
        if (owners.length === 0) return [number];
        return owners.map((owner) => catalogLabel(owner, number));
      }),
    );

    if (conflict || (matchesProject && ownersOf(fileCads.find((token) => needles.includes(token)) ?? "", input.catalog).length > 1)) {
      remember(
        discovered({
          project: input.project,
          thread,
          status: "ambiguous",
          evidenceBasis: basis({
            flags: ["conflicting_project_numbers"],
            projectNumbers: fileNumbers.filter((token) => needles.includes(token)),
            conflictingProjectNumbers: unique([...fileCads, ...subjectCads]),
            attachmentNames: files,
          }),
          possibleMatches,
        }),
      );
      continue;
    }

    if (unresolved(input.project) && (matchesProject || personCommercial)) {
      remember(
        discovered({
          project: input.project,
          thread,
          status: "ambiguous",
          evidenceBasis: basis({
            flags: ["unresolved_identity", ...(matchesProject ? ["exact_attachment_project_number" as const] : [])],
            projectNumbers: needles.filter((token) => fileNumbers.includes(token) || subjectNumbers.includes(token)),
            attachmentNames: files,
          }),
          possibleMatches: [catalogLabel(input.project, needles[0] ?? input.project.label)],
        }),
      );
      continue;
    }

    const evidenceFlags: ProjectEvidenceBasisFlag[] = [];
    if (matchesProject) evidenceFlags.push("exact_attachment_project_number");
    if (personCommercial || (matchesProject && knownPersonCommercial(input.project, thread.subjects, needles))) {
      evidenceFlags.push("known_person_commercial");
    }
    remember(
      discovered({
        project: input.project,
        thread,
        status: "candidate",
        evidenceBasis: basis({
          flags: evidenceFlags,
          projectNumbers: needles.filter((token) => fileNumbers.includes(token) || subjectNumbers.includes(token)),
          attachmentNames: files,
        }),
        possibleMatches: [],
      }),
    );
  }

  return rows;
}

export function applyReviewedAssociations(
  discovered: readonly DiscoveredProjectEvidence[],
  reviewed: readonly ReviewedProjectEvidence[],
): DiscoveredProjectEvidence[] {
  const byIdentity = new Map(discovered.map((row) => [row.sourceIdentity, row]));
  for (const review of reviewed) {
    const identity = canonicalThread(review.sourceIdentity);
    if (!identity) continue;
    if (review.status !== "trusted" && review.status !== "rejected") continue;
    const current = byIdentity.get(identity);
    const nextFlags =
      review.status === "trusted"
        ? flagsOf([...(current?.basis.flags ?? review.basis.flags), "founder_approval"])
        : flagsOf([...(current?.basis.flags ?? review.basis.flags), "founder_rejection"]);
    const nextBasis = basis({
      flags: nextFlags,
      projectNumbers: current?.basis.projectNumbers ?? review.basis.projectNumbers,
      conflictingProjectNumbers:
        current?.basis.conflictingProjectNumbers ?? review.basis.conflictingProjectNumbers,
      attachmentNames: current?.basis.attachmentNames ?? review.basis.attachmentNames,
    });
    if (!current && review.status === "rejected") {
      continue;
    }
    byIdentity.set(identity, {
      projectId: current?.projectId ?? "",
      sourceType: "gmail",
      sourceIdentity: identity,
      sourceThreadId: identity,
      status: review.status,
      basis: nextBasis,
      earliest: current?.earliest ?? null,
      latest: current?.latest ?? null,
      subject: current?.subject ?? null,
      attachmentNames: nextBasis.attachmentNames,
      reason:
        review.status === "trusted"
          ? "Founder added this thread to the project."
          : "Founder marked this thread as not this project.",
      possibleMatches: review.status === "trusted" ? [] : (current?.possibleMatches ?? []),
    });
  }
  return [...byIdentity.values()];
}

export function trustedEvidenceThreadIds(
  rows: readonly DiscoveredProjectEvidence[],
): string[] {
  return unique(
    rows.filter((row) => row.status === "trusted").map((row) => row.sourceIdentity),
  );
}

export function evidenceReviewFromDiscovery(
  projectId: string,
  rows: readonly DiscoveredProjectEvidence[],
): ProjectEvidenceReview | null {
  const reviewRows = rows.filter((row) => row.status === "candidate" || row.status === "ambiguous");
  const ambiguous = reviewRows
    .filter((row) => row.status === "ambiguous")
    .slice(0, PROJECT_EVIDENCE_THREAD_LIMIT);
  const possible = reviewRows
    .filter((row) => row.status === "candidate")
    .slice(0, Math.max(0, PROJECT_EVIDENCE_THREAD_LIMIT - ambiguous.length));
  const item = (row: DiscoveredProjectEvidence): ProjectEvidenceReviewItem => ({
    reviewKey: projectEvidenceReviewKey(projectId, row.sourceIdentity),
    channel: "Gmail",
    earliest: row.earliest,
    latest: row.latest,
    subject: row.subject,
    attachmentNames: row.attachmentNames,
    reason: row.reason,
    possibleMatches: row.possibleMatches,
  });
  if (ambiguous.length === 0 && possible.length === 0) return null;
  return {
    possible: possible.map(item),
    ambiguous: ambiguous.map(item),
  };
}

export function emptyEvidenceBasis(): ProjectEvidenceBasis {
  return basis({ flags: [] });
}
