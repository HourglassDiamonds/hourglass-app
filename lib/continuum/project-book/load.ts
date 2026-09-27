/**
 * Bounded Project Book load for one canonical project.
 * Trusted chronology comes from an exact stored thread or a founder-trusted
 * association. Candidate discovery is review-only and does not scan the mailbox
 * without a project number. Read-only. No model call. No Gmail API call.
 */

import "server-only";

import { rowToCandidate } from "@/lib/continuum/candidates/rows";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { readProjectEvidence } from "@/lib/continuum/project-evidence/load";
import type { ProjectEvidenceReview } from "@/lib/continuum/project-evidence/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PROJECT_HISTORY_NEEDS_REVIEW } from "./admit";
import { projectBook } from "./project";
import { projectBookRecordsFromSourceEvents } from "./records";
import type { ProjectBookRead } from "./types";

const MESSAGE_LIMIT = 80;
const CANDIDATE_LIMIT = 200;
const MESSAGE_COLUMNS =
  "thread_id, message_id, sent_at, direction, subject, from_email_hash, has_attachments";
const CANDIDATE_COLUMNS =
  "candidate_id, source_system, source_ref, source_timestamp, candidate_type, proposed_target, payload, confidence, evidence_basis, candidate_state, review_status, last_review_action, founder_edited_payload, founder_edited_target, reviewed_at, created_at, parser_version, supersedes_candidate_id, superseded_by_candidate_id";

export function emptyProjectBook(input: {
  projectId: string;
  projectLabel: string;
  nowIso?: string;
  review?: string | null;
  evidenceReview?: ProjectEvidenceReview | null;
}): ProjectBookRead {
  const book = projectBook({
    projectId: input.projectId,
    projectLabel: input.projectLabel,
    records: [],
    nowIso: input.nowIso,
    evidenceReview: input.evidenceReview,
  });
  if (!input.review) return book;
  return {
    ...book,
    historyState: "needs_review",
    currentState: {
      ...book.currentState,
      semanticClass: "unknown",
      headline: "Insufficient project history",
      lastMeaningfulChange: null,
      nextCheckpoint: null,
    },
    unresolved: [],
    associationReview: {
      status: "needs_review",
      summary: input.review,
      count: 1,
    },
  };
}

function directionOf(value: unknown): "inbound" | "outbound" | "unknown" {
  if (value === "inbound" || value === "outbound") return value;
  return "unknown";
}

export async function loadProjectBook(input: {
  projectId: string;
  projectLabel: string;
  nowIso?: string;
}): Promise<ProjectBookRead> {
  const projectId = input.projectId.trim();
  const projectLabel = input.projectLabel.trim() || "Project";
  const empty = (review?: string | null, evidenceReview?: ProjectEvidenceReview | null) =>
    emptyProjectBook({
      projectId,
      projectLabel,
      nowIso: input.nowIso,
      review,
      evidenceReview,
    });
  try {
    const client = getSupabaseAdmin();
    if (!client) return empty();
    const history = await client
      .from("continuum_project_history")
      .select("project_id, gmail_thread_id, cad_job_number, order_number, match_judgment, match_judgment_raw")
      .eq("project_id", projectId)
      .limit(1);
    if (history.error) return empty();
    const notes = await client
      .from("continuum_source_notes")
      .select("note_text")
      .eq("project_id", projectId)
      .limit(16);
    const noteTexts = notes.error || !notes.data ? [] : notes.data.map((row) => String(row.note_text ?? ""));
    const historyRow = history.data?.[0];
    const evidence = await readProjectEvidence(client, {
      projectId,
      projectLabel,
      history: historyRow
        ? {
            cadJobNumber: historyRow.cad_job_number == null ? null : String(historyRow.cad_job_number),
            orderNumber: historyRow.order_number == null ? null : String(historyRow.order_number),
            gmailThreadId: historyRow.gmail_thread_id == null ? null : String(historyRow.gmail_thread_id),
            matchJudgment: historyRow.match_judgment == null ? null : String(historyRow.match_judgment),
            matchJudgmentRaw:
              historyRow.match_judgment_raw == null ? null : String(historyRow.match_judgment_raw),
          }
        : null,
      noteTexts,
    });
    const trustedIds = evidence.trustedThreadIds.slice(0, 4);
    if (trustedIds.length === 0) {
      return empty(
        evidence.storedWithheld ? PROJECT_HISTORY_NEEDS_REVIEW : null,
        evidence.evidenceReview,
      );
    }

    const [messages, attachments, knownPeople, candidateGroups] = await Promise.all([
      client
        .from("continuum_gmail_messages")
        .select(MESSAGE_COLUMNS)
        .in("thread_id", [...trustedIds])
        .order("sent_at", { ascending: false })
        .limit(MESSAGE_LIMIT * trustedIds.length),
      client
        .from("continuum_gmail_attachments")
        .select("thread_id, message_id, filename")
        .in("thread_id", [...trustedIds]),
      loadTodayKnownEmailPeople(),
      Promise.all(
        trustedIds.map((threadId) =>
          client
            .from("continuum_candidates")
            .select(CANDIDATE_COLUMNS)
            .eq("source_system", "gmail")
            .like("source_ref", `gc1|${threadId}|%`)
            .limit(CANDIDATE_LIMIT),
        ),
      ),
    ]);
    if (messages.error || !messages.data) {
      return empty(
        evidence.storedWithheld ? PROJECT_HISTORY_NEEDS_REVIEW : null,
        evidence.evidenceReview,
      );
    }

    const filesByMessage = new Map<string, string[]>();
    if (!attachments.error && attachments.data) {
      for (const row of attachments.data) {
        const messageId = String(row.message_id ?? "").trim();
        const filename = String(row.filename ?? "").trim();
        if (!messageId || !filename) continue;
        const list = filesByMessage.get(messageId) ?? [];
        if (!list.includes(filename)) list.push(filename);
        filesByMessage.set(messageId, list);
      }
    }

    const threadContext = new Map<string, TodayGmailThreadContext>();
    for (const row of messages.data) {
      const threadId = String(row.thread_id ?? "").trim();
      const messageId = String(row.message_id ?? "").trim();
      const sentAt = String(row.sent_at ?? "").trim();
      if (!threadId || !messageId || !sentAt) continue;
      const thread = threadContext.get(threadId) ?? { messages: [] };
      const files = filesByMessage.get(messageId) ?? [];
      thread.subject = thread.subject ?? (row.subject == null ? null : String(row.subject));
      const messagesForThread = [...(thread.messages ?? [])];
      if (messagesForThread.length < MESSAGE_LIMIT) {
        messagesForThread.push({
          messageId,
          sentAt,
          direction: directionOf(row.direction),
          fromEmailHash: row.from_email_hash == null ? null : String(row.from_email_hash),
          subject: row.subject == null ? null : String(row.subject),
          hasAttachments: Boolean(row.has_attachments) || files.length > 0,
          attachmentFilenames: files,
        });
      }
      thread.messages = messagesForThread;
      threadContext.set(threadId, thread);
    }

    const candidates = [];
    for (const candidateRows of candidateGroups) {
      if (candidateRows.error || !candidateRows.data) continue;
      for (const row of candidateRows.data) {
        try {
          candidates.push(rowToCandidate(row as Record<string, unknown>));
        } catch {
          continue;
        }
      }
    }

    const events = projectGmailSourceEvents({
      threadContext,
      knownPeople,
      candidates,
      projectIdByThread: new Map(trustedIds.map((threadId) => [threadId, projectId])),
    });
    return projectBook({
      projectId,
      projectLabel,
      records: projectBookRecordsFromSourceEvents(events),
      nowIso: input.nowIso,
      evidenceReview: evidence.evidenceReview,
    });
  } catch {
    return empty();
  }
}
