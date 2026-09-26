/**
 * Bounded Project Book load for one canonical project.
 * Uses the stored Gmail thread pointer only. Does not match subjects,
 * names, calendar titles, or filenames onto a project.
 * Read-only. No model call. No Gmail API call.
 */

import "server-only";

import { rowToCandidate } from "@/lib/continuum/candidates/rows";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { loadTodayKnownEmailPeople } from "@/lib/continuum/client-memory/today-known-people";
import { correlateExactProjectThread } from "@/lib/continuum/gmail/projects";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PROJECT_HISTORY_NEEDS_REVIEW, projectThreadAssociationTrust } from "./admit";
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
}): ProjectBookRead {
  const book = projectBook({
    projectId: input.projectId,
    projectLabel: input.projectLabel,
    records: [],
    nowIso: input.nowIso,
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
  const empty = () =>
    emptyProjectBook({ projectId, projectLabel, nowIso: input.nowIso });
  try {
    const client = getSupabaseAdmin();
    if (!client) return empty();
    const history = await client
      .from("continuum_project_history")
      .select("project_id, gmail_thread_id, match_judgment, match_judgment_raw")
      .eq("project_id", projectId)
      .limit(1);
    if (history.error || !history.data?.length) return empty();
    const coerced = coerceGmailThreadId(history.data[0]?.gmail_thread_id ?? null);
    if (coerced.status !== "canonical") return empty();
    const threadId = coerced.value;
    const notes = await client
      .from("continuum_source_notes")
      .select("note_text")
      .eq("project_id", projectId)
      .limit(16);
    const trust = projectThreadAssociationTrust({
      matchJudgment:
        history.data[0]?.match_judgment == null ? null : String(history.data[0].match_judgment),
      matchJudgmentRaw:
        history.data[0]?.match_judgment_raw == null
          ? null
          : String(history.data[0].match_judgment_raw),
      noteTexts: notes.error || !notes.data ? [] : notes.data.map((row) => String(row.note_text ?? "")),
    });
    if (trust === "needs_review") {
      return emptyProjectBook({
        projectId,
        projectLabel,
        nowIso: input.nowIso,
        review: PROJECT_HISTORY_NEEDS_REVIEW,
      });
    }
    const claimants = await client
      .from("continuum_project_history")
      .select("project_id, gmail_thread_id")
      .eq("gmail_thread_id", threadId);
    if (claimants.error || !claimants.data) return empty();
    const match = correlateExactProjectThread(
      threadId,
      claimants.data.map((row) => ({
        projectId: String(row.project_id ?? ""),
        gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
      })),
    );
    if (match.status !== "exact" || match.projectIds.length !== 1 || match.projectIds[0] !== projectId) {
      return emptyProjectBook({
        projectId,
        projectLabel,
        nowIso: input.nowIso,
        review: PROJECT_HISTORY_NEEDS_REVIEW,
      });
    }

    const [messages, attachments, candidateRows, knownPeople] = await Promise.all([
      client
        .from("continuum_gmail_messages")
        .select(MESSAGE_COLUMNS)
        .eq("thread_id", threadId)
        .order("sent_at", { ascending: false })
        .limit(MESSAGE_LIMIT),
      client
        .from("continuum_gmail_attachments")
        .select("thread_id, message_id, filename")
        .eq("thread_id", threadId),
      client
        .from("continuum_candidates")
        .select(CANDIDATE_COLUMNS)
        .eq("source_system", "gmail")
        .like("source_ref", `gc1|${threadId}|%`)
        .limit(CANDIDATE_LIMIT),
      loadTodayKnownEmailPeople(),
    ]);
    if (messages.error || !messages.data) return empty();

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

    const thread: TodayGmailThreadContext = { messages: [] };
    for (const row of messages.data) {
      const messageId = String(row.message_id ?? "").trim();
      const sentAt = String(row.sent_at ?? "").trim();
      if (!messageId || !sentAt) continue;
      const files = filesByMessage.get(messageId) ?? [];
      thread.subject = thread.subject ?? (row.subject == null ? null : String(row.subject));
      thread.messages = [
        ...(thread.messages ?? []),
        {
          messageId,
          sentAt,
          direction: directionOf(row.direction),
          fromEmailHash: row.from_email_hash == null ? null : String(row.from_email_hash),
          subject: row.subject == null ? null : String(row.subject),
          hasAttachments: Boolean(row.has_attachments) || files.length > 0,
          attachmentFilenames: files,
        },
      ];
    }

    const candidates = [];
    if (!candidateRows.error && candidateRows.data) {
      for (const row of candidateRows.data) {
        try {
          candidates.push(rowToCandidate(row as Record<string, unknown>));
        } catch {
          continue;
        }
      }
    }

    const events = projectGmailSourceEvents({
      threadContext: new Map([[threadId, thread]]),
      knownPeople,
      candidates,
      projectIdByThread: new Map([[threadId, projectId]]),
    });
    return projectBook({
      projectId,
      projectLabel,
      records: projectBookRecordsFromSourceEvents(events),
      nowIso: input.nowIso,
    });
  } catch {
    return empty();
  }
}
