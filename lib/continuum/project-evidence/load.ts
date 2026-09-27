/**
 * Bounded read of project evidence membership.
 * Uses the project's stored identifiers and an exact project-number lookup.
 * A missing lookup function returns no filename candidates. It does not scan filenames.
 * Does not scan the mailbox, call a model, or write.
 * A missing association table does not blank stored exact history.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { projectHistoryDistrust } from "@/lib/continuum/project-book/admit";
import {
  applyReviewedAssociations,
  discoverProjectEvidence,
  evidenceReviewFromDiscovery,
  strictProjectNumbers,
  trustedEvidenceThreadIds,
} from "./discover";
import type {
  DiscoveredProjectEvidence,
  ProjectEvidenceBasis,
  ProjectEvidenceReview,
  ProjectEvidenceStatus,
  ReviewedProjectEvidence,
} from "./types";
import {
  PROJECT_EVIDENCE_ATTACHMENT_LOOKUP_LIMIT,
  PROJECT_EVIDENCE_MESSAGE_LIMIT,
  PROJECT_EVIDENCE_TABLE,
  PROJECT_EVIDENCE_THREAD_LOOKUP_RPC,
  PROJECT_EVIDENCE_THREAD_LIMIT,
} from "./types";

export type ProjectEvidenceRead = {
  trustedThreadIds: readonly string[];
  storedWithheld: boolean;
  evidenceReview: ProjectEvidenceReview | null;
  discovered: readonly DiscoveredProjectEvidence[];
};

type HistoryPointer = {
  cadJobNumber: string | null;
  orderNumber: string | null;
  gmailThreadId: string | null;
  matchJudgment: string | null;
  matchJudgmentRaw: string | null;
};

function text(value: unknown): string | null {
  if (value == null) return null;
  const next = String(value).trim();
  return next || null;
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes(PROJECT_EVIDENCE_TABLE) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

function asBasis(value: unknown): ProjectEvidenceBasis {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const list = (key: string) =>
    Array.isArray(row[key]) ? row[key].map((item) => String(item)) : [];
  return {
    flags: list("flags") as ProjectEvidenceBasis["flags"],
    projectNumbers: list("projectNumbers"),
    conflictingProjectNumbers: list("conflictingProjectNumbers"),
    attachmentNames: list("attachmentNames"),
  };
}

function asStatus(value: unknown): ProjectEvidenceStatus | null {
  if (value === "candidate" || value === "trusted" || value === "rejected" || value === "ambiguous") {
    return value;
  }
  return null;
}

export async function readProjectEvidence(
  client: SupabaseClient,
  input: {
    projectId: string;
    projectLabel: string;
    history: HistoryPointer | null;
    noteTexts: readonly string[];
  },
): Promise<ProjectEvidenceRead> {
  const projectId = input.projectId.trim();
  const history = input.history;
  const needles = [
    ...strictProjectNumbers(history?.cadJobNumber ?? ""),
    ...strictProjectNumbers(history?.orderNumber ?? ""),
  ];
  const stored = history?.gmailThreadId ? coerceGmailThreadId(history.gmailThreadId) : null;
  const storedThreadId = stored?.status === "canonical" ? stored.value : null;
  const distrust = projectHistoryDistrust({
    matchJudgmentRaw: history?.matchJudgmentRaw,
    noteTexts: input.noteTexts,
  });
  const judgment = (history?.matchJudgment ?? "").trim().toLowerCase();
  const storedWithheld =
    Boolean(storedThreadId) &&
    (distrust ||
      judgment === "ambiguous" ||
      judgment === "no-exact" ||
      judgment === "malformed-source-value");

  const [reviewed, people, claimants] = await Promise.all([
    loadReviewed(client, projectId),
    loadLinkedLabels(client, projectId),
    storedThreadId ? loadClaimants(client, storedThreadId) : Promise.resolve([]),
  ]);

  const threadIds = new Set<string>();
  if (storedThreadId) threadIds.add(storedThreadId);
  for (const row of reviewed) {
    if (row.status === "trusted" || row.status === "rejected") threadIds.add(row.sourceIdentity);
  }
  const attachmentRows = await loadAttachmentHits(client, needles);
  for (const row of attachmentRows) threadIds.add(row.threadId);
  const boundedIds = [...threadIds].slice(0, PROJECT_EVIDENCE_THREAD_LIMIT + 4);
  const threads = await loadThreads(client, boundedIds);
  const numbers = [
    ...new Set(threads.flatMap((thread) => thread.attachmentFilenames.flatMap((name) => strictProjectNumbers(name)))),
  ].slice(0, 12);
  const catalog = await loadCatalog(client, projectId, input.projectLabel, history, numbers);

  const discovered = applyReviewedAssociations(
    discoverProjectEvidence({
      project: {
        projectId,
        label: input.projectLabel,
        cadJobNumber: history?.cadJobNumber ?? null,
        orderNumber: history?.orderNumber ?? null,
        storedThreadId,
        matchJudgment: history?.matchJudgment ?? null,
        distrust,
        linkedPersonLabels: people,
      },
      catalog,
      threads,
      claimantProjectIds: claimants,
    }),
    reviewed,
  );

  return {
    trustedThreadIds: trustedEvidenceThreadIds(discovered),
    storedWithheld,
    evidenceReview: evidenceReviewFromDiscovery(projectId, discovered),
    discovered,
  };
}

async function loadReviewed(
  client: SupabaseClient,
  projectId: string,
): Promise<ReviewedProjectEvidence[]> {
  const result = await client
    .from(PROJECT_EVIDENCE_TABLE)
    .select("source_identity, status, basis")
    .eq("project_id", projectId)
    .limit(40);
  if (result.error) {
    if (missingTable(result.error)) return [];
    return [];
  }
  const rows: ReviewedProjectEvidence[] = [];
  for (const row of result.data ?? []) {
    const status = asStatus(row.status);
    const sourceIdentity = text(row.source_identity);
    if (!status || !sourceIdentity) continue;
    rows.push({ sourceIdentity, status, basis: asBasis(row.basis) });
  }
  return rows;
}

async function loadLinkedLabels(client: SupabaseClient, projectId: string): Promise<string[]> {
  const links = await client
    .from("continuum_relationships")
    .select("from_entity_id")
    .eq("to_entity_id", projectId)
    .eq("kind", "client-project")
    .eq("status", "active")
    .limit(8);
  if (links.error || !links.data?.length) return [];
  const ids = links.data.map((row) => String(row.from_entity_id ?? "")).filter(Boolean);
  if (ids.length === 0) return [];
  const people = await client
    .from("continuum_person_profiles")
    .select("display_name")
    .in("person_id", ids)
    .limit(8);
  if (people.error || !people.data) return [];
  return people.data.map((row) => String(row.display_name ?? "").trim()).filter(Boolean);
}

async function loadClaimants(
  client: SupabaseClient,
  threadId: string,
): Promise<string[] | null> {
  const result = await client
    .from("continuum_project_history")
    .select("project_id, gmail_thread_id")
    .eq("gmail_thread_id", threadId)
    .limit(8);
  if (result.error || !result.data) return null;
  return result.data.map((row) => String(row.project_id ?? "")).filter(Boolean);
}

async function loadAttachmentHits(
  client: SupabaseClient,
  needles: readonly string[],
): Promise<{ threadId: string }[]> {
  try {
    const hits: { threadId: string }[] = [];
    for (const needle of needles.slice(0, 2)) {
      const result = await client.rpc(PROJECT_EVIDENCE_THREAD_LOOKUP_RPC, {
        p_identifier: needle,
      });
      if (result.error || !result.data) continue;
      const rows = Array.isArray(result.data) ? result.data : [];
      for (const row of rows) {
        const threadId = text((row as { thread_id?: unknown }).thread_id);
        if (threadId) hits.push({ threadId });
        if (hits.length >= PROJECT_EVIDENCE_ATTACHMENT_LOOKUP_LIMIT) return hits;
      }
    }
    return hits;
  } catch {
    return [];
  }
}

async function loadThreads(
  client: SupabaseClient,
  threadIds: readonly string[],
): Promise<
  {
    threadId: string;
    subjects: string[];
    attachmentFilenames: string[];
    earliest: string | null;
    latest: string | null;
  }[]
> {
  if (threadIds.length === 0) return [];
  const [attachments, messages] = await Promise.all([
    client
      .from("continuum_gmail_attachments")
      .select("thread_id, filename")
      .in("thread_id", [...threadIds])
      .limit(200),
    client
      .from("continuum_gmail_messages")
      .select("thread_id, sent_at, subject")
      .in("thread_id", [...threadIds])
      .order("sent_at", { ascending: true })
      .limit(PROJECT_EVIDENCE_MESSAGE_LIMIT * 2),
  ]);
  const byThread = new Map<
    string,
    { subjects: string[]; attachmentFilenames: string[]; earliest: string | null; latest: string | null }
  >();
  const ensure = (threadId: string) => {
    const current = byThread.get(threadId);
    if (current) return current;
    const created = { subjects: [], attachmentFilenames: [], earliest: null, latest: null };
    byThread.set(threadId, created);
    return created;
  };
  for (const threadId of threadIds) ensure(threadId);
  if (!attachments.error && attachments.data) {
    for (const row of attachments.data) {
      const threadId = text(row.thread_id);
      const filename = text(row.filename);
      if (!threadId || !filename) continue;
      const bucket = ensure(threadId);
      if (!bucket.attachmentFilenames.includes(filename)) bucket.attachmentFilenames.push(filename);
    }
  }
  if (!messages.error && messages.data) {
    for (const row of messages.data) {
      const threadId = text(row.thread_id);
      if (!threadId) continue;
      const bucket = ensure(threadId);
      const subject = text(row.subject);
      if (subject && !bucket.subjects.includes(subject)) bucket.subjects.push(subject);
      const sentAt = text(row.sent_at);
      if (!sentAt) continue;
      if (!bucket.earliest || sentAt < bucket.earliest) bucket.earliest = sentAt;
      if (!bucket.latest || sentAt > bucket.latest) bucket.latest = sentAt;
    }
  }
  return [...byThread.entries()].map(([threadId, row]) => ({ threadId, ...row }));
}

async function loadCatalog(
  client: SupabaseClient,
  projectId: string,
  projectLabel: string,
  history: HistoryPointer | null,
  numbers: readonly string[],
): Promise<
  {
    projectId: string;
    label: string;
    cadJobNumber: string | null;
    orderNumber: string | null;
  }[]
> {
  const current = {
    projectId,
    label: projectLabel,
    cadJobNumber: history?.cadJobNumber ?? null,
    orderNumber: history?.orderNumber ?? null,
  };
  if (numbers.length === 0) return [current];
  const [byCad, byOrder] = await Promise.all([
    client
      .from("continuum_project_history")
      .select("project_id, cad_job_number, order_number")
      .in("cad_job_number", [...numbers])
      .limit(20),
    client
      .from("continuum_project_history")
      .select("project_id, cad_job_number, order_number")
      .in("order_number", [...numbers])
      .limit(20),
  ]);
  const historyRows = [...(byCad.data ?? []), ...(byOrder.data ?? [])];
  if ((byCad.error && byOrder.error) || historyRows.length === 0) return [current];
  const ids = [...new Set(historyRows.map((row) => String(row.project_id ?? "")).filter(Boolean))];
  const profiles = await client
    .from("continuum_project_profiles")
    .select("project_id, display_title")
    .in("project_id", ids)
    .limit(20);
  const titles = new Map(
    (profiles.data ?? []).map((row) => [String(row.project_id), String(row.display_title ?? "")]),
  );
  const catalog: {
    projectId: string;
    label: string;
    cadJobNumber: string | null;
    orderNumber: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const row of historyRows) {
    const id = String(row.project_id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    catalog.push({
      projectId: id,
      label: titles.get(id) || "Project",
      cadJobNumber: text(row.cad_job_number),
      orderNumber: text(row.order_number),
    });
  }
  if (!catalog.some((row) => row.projectId === projectId)) catalog.unshift(current);
  return catalog;
}
