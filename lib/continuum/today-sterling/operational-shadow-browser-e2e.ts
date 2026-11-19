import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { candidateToRow } from "@/lib/continuum/candidates/rows";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { LiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";
import { STERLING_TODAY_PROPOSAL_VERSION } from "./types";
import { InMemoryOperationalShadowResultStore } from "./operational-shadow-result-store";
import { InMemorySterlingRunLeaseStore } from "./run-lease";
import { isOperationalShadowBrowserE2eRuntime } from
  "./operational-shadow-browser-e2e-runtime";

export { isOperationalShadowBrowserE2eRuntime } from
  "./operational-shadow-browser-e2e-runtime";

/**
 * Production-build browser fixture. It is deliberately impossible on Vercel
 * and exists only to exercise the shipped proxy/routes/assembler in a local
 * `next start` process with synthetic external dependencies.
 */
export const browserE2eResultStore = new InMemoryOperationalShadowResultStore();
export const browserE2eLeaseStore = new InMemorySterlingRunLeaseStore();

export async function authenticateOperationalShadowBrowserE2e(): Promise<boolean> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  return session.ok;
}

const NOW = "2026-11-16T15:00:00.000Z";
const FOUNDER_HASH = "f".repeat(64);

function syntheticCandidate(threadId: string, index: number): ContinuumCandidate {
  const messageId = `synthetic-message-${String(index + 1).padStart(2, "0")}`;
  return {
    candidateId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    sourceSystem: "gmail",
    sourceRef: `gc1|${threadId}|${messageId}`,
    sourceTimestamp: new Date(Date.parse(NOW) + index * 60_000).toISOString(),
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text: `Synthetic operational evidence ${index + 1}.`, contextLayer: null },
    confidence: "high",
    evidenceBasis: { ruleIds: ["browser-e2e-synthetic"], matchedText: `Synthetic operational evidence ${index + 1}.` },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: "browser-e2e-synthetic",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

const candidates = NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.map(syntheticCandidate);
const gmailMessages = candidates.map((candidate, index) => {
  const [, threadId, messageId] = candidate.sourceRef.split("|");
  return {
    thread_id: threadId,
    message_id: messageId,
    sent_at: new Date(Date.parse(NOW) + index * 60_000).toISOString(),
    direction: index % 2 === 0 ? "inbound" : "outbound",
    subject: `Synthetic scoped thread ${index + 1}`,
    label_ids: [],
    from_email_hash: index % 2 === 0 ? String(index + 1).padStart(64, "0") : FOUNDER_HASH,
    to_email_hashes: [],
    has_attachments: false,
    indexed_at: NOW,
  };
});

const rowsByTable = new Map<string, Record<string, unknown>[]>([
  ["continuum_candidates", candidates.map(candidateToRow) as unknown as Record<string, unknown>[]],
  ["continuum_gmail_messages", gmailMessages],
]);

type Filter = { kind: "eq" | "in" | "overlaps" | "gte" | "lte" | "lt" | "is" | "like" | "ilike" | "neq"; column: string; value: unknown };

function queryFor(table: string) {
  const filters: Filter[] = [];
  let limitCount: number | null = null;
  let range: [number, number] | null = null;
  let countMode = false;
  let headMode = false;
  let deleting = false;
  const query = {
    select(_columns = "*", options?: { count?: string; head?: boolean }) {
      countMode = options?.count === "exact";
      headMode = options?.head === true;
      return query;
    },
    eq(column: string, value: unknown) { filters.push({ kind: "eq", column, value }); return query; },
    in(column: string, value: readonly unknown[]) { filters.push({ kind: "in", column, value }); return query; },
    overlaps(column: string, value: readonly unknown[]) { filters.push({ kind: "overlaps", column, value }); return query; },
    gte(column: string, value: unknown) { filters.push({ kind: "gte", column, value }); return query; },
    lte(column: string, value: unknown) { filters.push({ kind: "lte", column, value }); return query; },
    lt(column: string, value: unknown) { filters.push({ kind: "lt", column, value }); return query; },
    is(column: string, value: unknown) { filters.push({ kind: "is", column, value }); return query; },
    like(column: string, value: unknown) { filters.push({ kind: "like", column, value }); return query; },
    ilike(column: string, value: unknown) { filters.push({ kind: "ilike", column, value }); return query; },
    neq(column: string, value: unknown) { filters.push({ kind: "neq", column, value }); return query; },
    not() { return query; },
    filter() { return query; },
    match(values: Record<string, unknown>) { for (const [column, value] of Object.entries(values)) filters.push({ kind: "eq", column, value }); return query; },
    contains() { return query; },
    order() { return query; },
    limit(value: number) { limitCount = value; return query; },
    range(from: number, to: number) { range = [from, to]; return Promise.resolve(result()); },
    or() { return query; },
    delete() { deleting = true; return query; },
    insert() { return query; },
    update() { return query; },
    upsert() { return query; },
    single() { const value = result(); return Promise.resolve({ ...value, data: Array.isArray(value.data) ? value.data[0] ?? null : value.data }); },
    maybeSingle() { const value = result(); return Promise.resolve({ ...value, data: Array.isArray(value.data) ? value.data[0] ?? null : value.data }); },
    then(resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result()).then(resolve, reject);
    },
  };
  function result() {
    let rows = [...(rowsByTable.get(table) ?? [])].filter((row) => filters.every((filter) => {
      const actual = row[filter.column];
      if (filter.kind === "eq") return actual === filter.value;
      if (filter.kind === "in") return (filter.value as readonly unknown[]).includes(actual);
      if (filter.kind === "overlaps") return Array.isArray(actual) && actual.some((value) => (filter.value as readonly unknown[]).includes(value));
      if (filter.kind === "is") return actual === filter.value;
      if (filter.kind === "neq") return actual !== filter.value;
      if (filter.kind === "like" || filter.kind === "ilike") {
        const pattern = String(filter.value ?? "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
        return new RegExp(`^${pattern}$`, filter.kind === "ilike" ? "i" : "").test(String(actual ?? ""));
      }
      if (filter.kind === "gte") return String(actual ?? "") >= String(filter.value ?? "");
      if (filter.kind === "lte") return String(actual ?? "") <= String(filter.value ?? "");
      return String(actual ?? "") < String(filter.value ?? "");
    }));
    if (range) rows = rows.slice(range[0], range[1] + 1);
    if (limitCount != null) rows = rows.slice(0, limitCount);
    if (deleting) rows = [];
    return { data: headMode ? null : rows, error: null, count: countMode ? rows.length : null };
  }
  return query;
}

export function createOperationalShadowBrowserE2eClient(): SupabaseClient {
  return { from: (table: string) => queryFor(table) } as unknown as SupabaseClient;
}

function syntheticMessage(threadId: string, index: number) {
  return {
    messageId: `synthetic-message-${String(index + 1).padStart(2, "0")}`,
    fromRaw: "Synthetic client",
    fromEmail: null,
    to: [],
    cc: [],
    subject: `Synthetic scoped thread ${index + 1}`,
    sentAt: new Date(Date.parse(NOW) + index * 60_000).toISOString(),
    plainText: `Synthetic complete body for reviewed thread ${index + 1}.`,
    bodyExtractionStatus: "decoded_plaintext" as const,
    snippet: "",
    attachments: [],
  };
}

export function createOperationalShadowBrowserE2eGmailBatch(): LiveSourceViewerBatch {
  return {
    credentialLoads: 1,
    metrics: { threadFetches: 0 },
    async fetchThread({ threadId }) {
      const index = (NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS as readonly string[]).indexOf(threadId);
      if (index < 0) return { ok: false, safeErrorCode: "not-indexed" } as const;
      this.metrics.threadFetches += 1;
      return { ok: true, safeErrorCode: null, threadId, indexedSubject: `Synthetic scoped thread ${index + 1}`,
        messages: [syntheticMessage(threadId, index)], gmailMutation: false, plaintextPersisted: false,
        cursorUnchanged: true, readOnly: true } as const;
    },
    async fetchCompleteThread({ threadId }) {
      const index = (NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS as readonly string[]).indexOf(threadId);
      if (index < 0) return { ok: false, safeErrorCode: "not-indexed" } as const;
      this.metrics.threadFetches += 1;
      return { ok: true, safeErrorCode: null, threadId, indexedSubject: `Synthetic scoped thread ${index + 1}`,
        messages: [syntheticMessage(threadId, index)], gmailMutation: false, plaintextPersisted: false,
        cursorUnchanged: true, readOnly: true, nativeThreadMembershipComplete: true } as const;
    },
  };
}

export const operationalShadowBrowserE2eModelFetch: typeof fetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body ?? "{}")) as { input?: string };
  const workingSet = JSON.parse(String(request.input ?? "{}")) as {
    contractVersion: string; runId: string; evidenceSnapshotId: string; generatedAt: string;
    workUnits: Array<{ workUnitId: string; projectId: string | null; evidenceRefs: string[] }>;
  };
  const proposal = {
    contractVersion: STERLING_TODAY_PROPOSAL_VERSION,
    runId: workingSet.runId,
    evidenceSnapshotId: workingSet.evidenceSnapshotId,
    generatedAt: workingSet.generatedAt,
    portfolioAssessments: workingSet.workUnits.map((unit) => ({
      workUnitId: unit.workUnitId, projectId: unit.projectId, identityStatus: unit.projectId ? "canonical_project" : "provisional_evidence",
      todayDisposition: "ambiguous", recommendationItemId: null,
      currentStage: { canonicalLifecycleStage: null, operationalSubstage: null, responsibleParty: "unknown",
        confidence: "low", explanation: "Synthetic evidence requires founder review.", evidenceRefs: unit.evidenceRefs.slice(0, 1) },
      obligations: [], nextStepOwner: "unknown", attentionPriority: "no_attention", confidence: "low",
      evidenceRefs: unit.evidenceRefs.slice(0, 1), ambiguities: ["Synthetic browser verification only."],
      explanation: "Synthetic browser verification exercised semantic validation.", omissionReason: "No business conclusion in synthetic verification.",
    })),
    recommendations: [], relationshipProposals: [], proposedCanonicalMutations: [],
    portfolioAmbiguities: ["Synthetic browser verification only."],
  };
  return new Response(JSON.stringify({ id: "resp_browser_e2e", status: "completed", output_text: JSON.stringify(proposal),
    usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200, output_tokens_details: { reasoning_tokens: 10 } } }),
  { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_browser_e2e" } });
};
