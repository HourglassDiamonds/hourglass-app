import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import { readProjectEvidence } from "@/lib/continuum/project-evidence/load";

const QUERY_CHUNK = 40;
const PROJECT_CONCURRENCY = 6;
const MESSAGES_PER_THREAD = 80;

function spec(project: ProjectDeskSummary, fieldName: "cad_job_number" | "order_number"): string | null {
  return project.specs?.find((row) => row.fieldName === fieldName)?.value?.trim() || null;
}

/**
 * Resolves only evidence associations already trusted by the canonical project-evidence
 * boundary. Candidate and ambiguous discoveries are intentionally not promoted here.
 */
export type SterlingProjectEvidenceThreads = {
  trustedByProject: Map<string, string[]>;
  discoveryThreadIds: string[];
  diagnosticsByProject: Map<string, {
    storedWithheld: boolean;
    trusted: number;
    candidate: number;
    ambiguous: number;
    rejected: number;
    basisFlags: string[];
  }>;
};

export async function loadSterlingProjectThreadIds(
  client: SupabaseClient,
  projects: readonly ProjectDeskSummary[],
): Promise<SterlingProjectEvidenceThreads> {
  const out = new Map<string, string[]>();
  const discoveryThreadIds = new Set<string>();
  const diagnosticsByProject = new Map<string, {
    storedWithheld: boolean; trusted: number; candidate: number; ambiguous: number; rejected: number; basisFlags: string[];
  }>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < projects.length) {
      const project = projects[cursor++]!;
      const evidence = await readProjectEvidence(client, {
        projectId: project.projectId,
        projectLabel: project.title,
        history: {
          cadJobNumber: spec(project, "cad_job_number"),
          orderNumber: spec(project, "order_number"),
          gmailThreadId: project.gmailThreadId ?? null,
          matchJudgment: null,
          matchJudgmentRaw: null,
        },
        noteTexts: [],
      });
      if (evidence.trustedThreadIds.length > 0) {
        out.set(project.projectId, [...new Set(evidence.trustedThreadIds)]);
      }
      diagnosticsByProject.set(project.projectId, {
        storedWithheld: evidence.storedWithheld,
        trusted: evidence.discovered.filter((row) => row.status === "trusted").length,
        candidate: evidence.discovered.filter((row) => row.status === "candidate").length,
        ambiguous: evidence.discovered.filter((row) => row.status === "ambiguous").length,
        rejected: evidence.discovered.filter((row) => row.status === "rejected").length,
        basisFlags: [...new Set(evidence.discovered.flatMap((row) => [...row.basis.flags]))],
      });
      for (const row of evidence.discovered) {
        if (row.status !== "rejected") discoveryThreadIds.add(row.sourceIdentity);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PROJECT_CONCURRENCY, projects.length) }, () => worker()),
  );
  return { trustedByProject: out, discoveryThreadIds: [...discoveryThreadIds], diagnosticsByProject };
}

function direction(value: unknown): "inbound" | "outbound" | "unknown" {
  return value === "inbound" || value === "outbound" ? value : "unknown";
}

/** Adds exact trusted project threads that the candidate-oriented Today loader cannot see. */
export async function expandSterlingIndexedThreadContext(
  client: SupabaseClient,
  base: ReadonlyMap<string, TodayGmailThreadContext>,
  threadIds: readonly string[],
): Promise<Map<string, TodayGmailThreadContext>> {
  const out = new Map(base);
  const missing = [...new Set(threadIds.map((id) => id.trim()).filter((id) => id && !out.has(id)))];
  for (let index = 0; index < missing.length; index += QUERY_CHUNK) {
    const chunk = missing.slice(index, index + QUERY_CHUNK);
    const [messages, attachments] = await Promise.all([
      client.from("continuum_gmail_messages")
        .select("thread_id, message_id, sent_at, direction, subject, label_ids, from_email_hash, has_attachments")
        .in("thread_id", chunk).order("sent_at", { ascending: true }),
      client.from("continuum_gmail_attachments")
        .select("thread_id, message_id, filename").in("thread_id", chunk),
    ]);
    if (messages.error || !messages.data) continue;
    const attachmentsByMessage = new Map<string, string[]>();
    const attachmentsByThread = new Map<string, string[]>();
    for (const row of attachments.data ?? []) {
      const threadId = String(row.thread_id ?? "").trim();
      const messageId = String(row.message_id ?? "").trim();
      const filename = String(row.filename ?? "").trim();
      if (!threadId || !filename) continue;
      attachmentsByThread.set(threadId, [...new Set([...(attachmentsByThread.get(threadId) ?? []), filename])]);
      if (messageId) attachmentsByMessage.set(`${threadId}|${messageId}`, [
        ...new Set([...(attachmentsByMessage.get(`${threadId}|${messageId}`) ?? []), filename]),
      ]);
    }
    for (const threadId of chunk) {
      const rows = messages.data.filter((row) => String(row.thread_id ?? "") === threadId)
        .slice(-MESSAGES_PER_THREAD);
      if (rows.length === 0) continue;
      out.set(threadId, {
        subject: rows.at(-1)?.subject == null ? null : String(rows.at(-1)?.subject),
        fromDisplayName: null,
        fromEmail: null,
        messages: rows.flatMap((row) => {
          const messageId = String(row.message_id ?? "").trim();
          const sentAt = String(row.sent_at ?? "").trim();
          if (!messageId || !sentAt) return [];
          const filenames = attachmentsByMessage.get(`${threadId}|${messageId}`) ?? [];
          return [{
            messageId,
            sentAt,
            direction: direction(row.direction),
            subject: row.subject == null ? null : String(row.subject),
            labelIds: Array.isArray(row.label_ids) ? row.label_ids.map(String) : undefined,
            fromEmailHash: row.from_email_hash == null ? null : String(row.from_email_hash),
            hasAttachments: Boolean(row.has_attachments) || filenames.length > 0,
            attachmentFilenames: filenames,
          }];
        }),
        attachmentFilenames: attachmentsByThread.get(threadId) ?? [],
      });
    }
  }
  return out;
}
