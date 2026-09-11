/**
 * Evidence matching for CoS reconciliation.
 * Read-only over Candidates. Does not invent evidence. Does not write.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { parseHumanEvidenceSourceRef } from "@/lib/continuum/candidates/human-evidence-source-ref";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import {
  conciergeInboxPath,
  conciergeInboxSourcePath,
} from "@/lib/continuum/client-memory/read/presentation";

const GMAIL_CANDIDATES_HREF =
  "/executive-dashboard/concierge/gmail/candidates" as const;
const CALENDAR_HREF = "/executive-dashboard/concierge/calendar" as const;
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";

const STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "please",
  "could",
  "would",
  "send",
  "make",
  "your",
  "their",
  "the",
  "and",
  "for",
  "was",
  "but",
  "not",
  "you",
  "are",
  "our",
  "she",
  "his",
]);

export function evidenceTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

export function sharesSubjectToken(job: ProjectJob, text: string): boolean {
  const jobTokens = new Set(evidenceTokens(job.subject));
  if (jobTokens.size === 0) return false;
  return evidenceTokens(text).some((token) => jobTokens.has(token));
}

export function candidateProjectId(row: ContinuumCandidate): string | null {
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "project" || target.kind === "project_spec") {
    return target.projectId;
  }
  if (target.kind === "open_job") return target.projectId;
  return null;
}

export function candidateText(row: ContinuumCandidate): string {
  const payload = row.founderEditedPayload ?? row.payload;
  if (payload.kind === "follow_up") return payload.text;
  if (payload.kind === "note") return payload.text;
  if (payload.kind === "open_job") {
    return `${payload.subject} ${payload.detail ?? ""}`;
  }
  if (payload.kind === "project_context") {
    return `${payload.topic} ${payload.value}`;
  }
  if (payload.kind === "date") return payload.raw;
  return row.evidenceBasis.matchedText ?? "";
}

export function candidateHaystack(row: ContinuumCandidate): string {
  return `${candidateText(row)} ${row.evidenceBasis.matchedText ?? ""}`;
}

export function isUsableEvidence(row: ContinuumCandidate): boolean {
  if (row.candidateState === "superseded") return false;
  if (row.reviewStatus === "discarded") return false;
  return true;
}

export function relatedToJob(
  job: ProjectJob,
  row: ContinuumCandidate,
): boolean {
  if (!isUsableEvidence(row)) return false;
  const projectId = candidateProjectId(row);
  const sameProject = Boolean(projectId && projectId === job.projectId);
  const tokens = sharesSubjectToken(job, candidateHaystack(row));
  if (row.payload.kind === "project_context") {
    return sameProject || tokens;
  }
  if (sameProject && tokens) return true;
  return tokens;
}

const COMPLETE_SIGNAL =
  /\b(sent|attached|shipped|please proceed|approved|looks great|looks awesome|client approval|on its way)\b/i;

const AMBIGUOUS_REPLY = /\b(replied|follow[- ]up|circle back|got this)\b/i;

const DELIVERABLE = /\b(cad|render|revision|quote|wax|file|tracking)\b/i;

export function looksComplete(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  if (row.payload.kind === "project_context" && row.payload.topic === "client_approval") {
    return true;
  }
  return COMPLETE_SIGNAL.test(hay);
}

export function looksAmbiguousReply(row: ContinuumCandidate, job: ProjectJob): boolean {
  const hay = candidateHaystack(row);
  if (looksComplete(row)) return false;
  if (!AMBIGUOUS_REPLY.test(hay) && row.payload.kind !== "follow_up") return false;
  return DELIVERABLE.test(job.subject) && !DELIVERABLE.test(hay);
}

export function looksClientResponse(row: ContinuumCandidate): boolean {
  if (row.sourceSystem !== "gmail") {
    return row.payload.kind === "note" || row.payload.kind === "follow_up";
  }
  if (row.payload.kind === "open_job" && row.payload.jobKind === "request") return true;
  if (row.payload.kind === "project_context") return true;
  return looksComplete(row);
}

export function looksVendorEvidence(row: ContinuumCandidate): boolean {
  const hay = candidateHaystack(row);
  if (row.payload.kind === "open_job" && row.payload.waitingOnActor === "vendor") {
    return true;
  }
  return /\b(vendor|shipped|when ready|we'll send|we will send|tracking)\b/i.test(hay);
}

export function looksOpenWork(row: ContinuumCandidate): boolean {
  if (row.payload.kind === "open_job") return true;
  if (row.payload.kind === "follow_up") return true;
  return /\b(can you|could you|please send|please revise|still waiting|not yet)\b/i.test(
    candidateHaystack(row),
  );
}

const GMAIL_THREAD_ID = /^[0-9a-f]{10,}$/i;
const GMAIL_WEB_THREAD = "https://mail.google.com/mail/u/0/#all/";

export function isSafeGmailThreadId(threadId: string): boolean {
  return GMAIL_THREAD_ID.test(threadId.trim());
}

export function parseGmailWebHref(
  href: string,
): { threadId: string; messageId: string | null } | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith(GMAIL_WEB_THREAD)) return null;
  const rest = trimmed.slice(GMAIL_WEB_THREAD.length);
  const [rawThread, rawMessage] = rest.split("/");
  const threadId = decodeURIComponent(rawThread ?? "").trim();
  if (!isSafeGmailThreadId(threadId)) return null;
  const messageId = decodeURIComponent(rawMessage ?? "").trim();
  return {
    threadId,
    messageId: isSafeGmailThreadId(messageId) ? messageId : null,
  };
}

export function gmailThreadHrefFor(row: ContinuumCandidate): string | null {
  if (row.sourceSystem !== "gmail") return null;
  const parsed = parseGmailCandidateSourceRef(row.sourceRef);
  if (!parsed || !isSafeGmailThreadId(parsed.threadId)) return null;
  return `${GMAIL_WEB_THREAD}${encodeURIComponent(parsed.threadId)}`;
}

export function gmailEvidenceHrefFor(row: ContinuumCandidate): string | null {
  if (row.sourceSystem !== "gmail") return null;
  const parsed = parseGmailCandidateSourceRef(row.sourceRef);
  if (!parsed || !isSafeGmailThreadId(parsed.threadId)) return null;
  if (isSafeGmailThreadId(parsed.messageId)) {
    return `${GMAIL_WEB_THREAD}${encodeURIComponent(parsed.threadId)}/${encodeURIComponent(parsed.messageId)}`;
  }
  return gmailThreadHrefFor(row);
}

export function sourceHrefFor(row: ContinuumCandidate): string {
  if (row.sourceSystem === "gmail") return GMAIL_CANDIDATES_HREF;
  if (row.sourceSystem === "google_calendar") return CALENDAR_HREF;
  const parsed = parseHumanEvidenceSourceRef(row.sourceRef);
  if (parsed?.sourceId) return conciergeInboxSourcePath(parsed.sourceId);
  return conciergeInboxPath();
}

export function sourceLabelFor(row: ContinuumCandidate): string {
  if (row.sourceSystem === "gmail") return "Gmail evidence";
  if (row.sourceSystem === "plaud") return "PLAUD";
  if (row.sourceSystem === "remarkable") return "reMarkable";
  if (row.sourceSystem === "human-intake") return "Human Intake";
  if (row.sourceSystem === "google_calendar") return "Calendar";
  return "Evidence";
}

export function afterTimestamp(iso: string, comparedTo: string | null): boolean {
  if (!comparedTo) return true;
  const a = Date.parse(iso);
  const b = Date.parse(comparedTo);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a > b;
}
