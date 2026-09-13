/**
 * Bounded Travis / Chicken-ring structured_spec provenance inspect + repair.
 * Read-only Gmail getThread for already-indexed Travis threads only.
 * Default: inspect. Pass --repair to update provenance metadata only.
 *
 * Does not approve, change canonical size, or alter review state.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createLiveGmailApi } from "../lib/continuum/gmail/adapter";
import { createSupabaseGmailIndexStore } from "../lib/continuum/client-memory/gmail/supabase";
import { withStructuredSpecProvenance } from "../lib/continuum/candidates/spec-provenance";
import { rowToCandidate, candidateToRow } from "../lib/continuum/candidates/rows";
import { CONTINUUM_CANDIDATES_TABLE } from "../lib/continuum/candidates/activation";
import { createSupabaseGmailConnectionStore } from "../lib/continuum/gmail/supabase";
import { runIndexedThreadEvidenceFetch } from "../lib/continuum/gmail/indexed-thread-evidence";
import { liveGmailAccessTokenRefresher } from "../lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "../lib/continuum/gmail/token-crypto";
import {
  exactSpecSpanInText,
  specValueEstablishedInText,
  splitOwnAndQuotedText,
} from "../lib/continuum/gmail/candidates/spec-provenance";
import { haystackOf } from "../lib/continuum/gmail/candidates/parse";
import { INDEXED_EIGHT_KNOWN_MESSAGE_IDS } from "../lib/continuum/gmail/candidates/indexed-dry-run";

const TRAVIS_CANDIDATE_ID =
  "e2f3673c23480009fc75c14eacf0ff2410794092feb9219364598cbda690af53";
const SHIP_THREAD = "19ffcce49298efeb";
const SHIP_MSG = "1a08c4df80609947";
const TRAVIS_KNOWN_IDS = [
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travis,
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travisVendor,
] as const;

function loadEnvFile(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(resolve(process.cwd(), ".env.production.local"));
loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.local"));
loadEnvFile(resolve(process.cwd(), ".env.continuum-preview.local"));
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--env-file=")) loadEnvFile(arg.slice("--env-file=".length));
}

function clip(text: string, max = 180): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trim()}…`;
}

function spanAround(text: string, needle: string): string | null {
  const hay = text.replace(/\s+/g, " ");
  const index = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - 60);
  return clip(hay.slice(start, index + needle.length + 80));
}

async function main() {
  const repair = process.argv.includes("--repair");
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    process.stdout.write("TRAVIS_PROVENANCE_UNAVAILABLE supabase-unconfigured\n");
    process.exit(2);
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from(CONTINUUM_CANDIDATES_TABLE)
    .select("*")
    .eq("candidate_id", TRAVIS_CANDIDATE_ID)
    .maybeSingle();
  if (error) {
    process.stdout.write(`TRAVIS_PROVENANCE_UNAVAILABLE ${error.code ?? "query-failed"}\n`);
    process.exit(2);
  }
  if (!data) {
    process.stdout.write("TRAVIS_CANDIDATE_NOT_FOUND\n");
    process.exit(2);
  }
  const candidate = rowToCandidate(data as Record<string, unknown>);
  const payload = candidate.payload;
  const proposed =
    payload.kind === "structured_spec" ? payload.proposedValue : "";
  const fieldName = payload.kind === "structured_spec" ? payload.fieldName : "";
  const reviewStatus = candidate.reviewStatus;
  const candidateState = candidate.candidateState;

  const threadIds = new Set<string>([SHIP_THREAD]);
  if (candidate.sourceRef.startsWith("gc1|")) {
    const parts = candidate.sourceRef.split("|");
    if (parts[1]) threadIds.add(parts[1]);
  }
  const { data: knownRows } = await client
    .from("continuum_gmail_messages")
    .select("message_id, thread_id")
    .or(
      `message_id.in.(${TRAVIS_KNOWN_IDS.join(",")}),thread_id.in.(${TRAVIS_KNOWN_IDS.join(",")})`,
    );
  for (const row of knownRows ?? []) {
    if (row.thread_id) threadIds.add(String(row.thread_id));
  }
  const { data: projectRows } = await client
    .from("continuum_project_profiles")
    .select("project_id, display_title")
    .ilike("display_title", "%chicken%");
  const chickenIds = (projectRows ?? []).map((row) => String(row.project_id));
  const { data: historyRows } = chickenIds.length
    ? await client
        .from("continuum_project_history")
        .select("project_id, gmail_thread_id, finger_size")
        .in("project_id", chickenIds)
    : { data: [] as { project_id: unknown; gmail_thread_id: unknown; finger_size: unknown }[] };
  for (const row of historyRows ?? []) {
    const thread = row.gmail_thread_id == null ? "" : String(row.gmail_thread_id);
    if (thread) threadIds.add(thread);
  }

  const kek = loadGmailTokenKek();
  let fetched: Awaited<ReturnType<typeof runIndexedThreadEvidenceFetch>> | null = null;
  let gmailFetchError: string | null = null;
  if (kek.ok) {
    fetched = await runIndexedThreadEvidenceFetch({
      founderSessionOk: false,
      secretProtectedOk: true,
      threadIds: [...threadIds],
      index: createSupabaseGmailIndexStore(client),
      connections: createSupabaseGmailConnectionStore(client),
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      refreshAccessToken: (refreshToken) =>
        liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      createApi: (accessToken) => createLiveGmailApi(accessToken),
    });
    if (!fetched.ok) {
      gmailFetchError = fetched.safeErrorCode;
      fetched = null;
    }
  } else {
    gmailFetchError = "kek-unconfigured";
  }

  const evidence = fetched && fetched.ok ? fetched.evidence : [];
  const { data: indexedRows } = await client
    .from("continuum_gmail_messages")
    .select("message_id, thread_id, sent_at, subject, from_email_hash")
    .in("thread_id", [...threadIds]);

  const shipping = evidence.find(
    (row) =>
      row.indexed.threadId === SHIP_THREAD && row.indexed.messageId === SHIP_MSG,
  );
  const indexedShipping = (indexedRows ?? []).find(
    (row) => String(row.thread_id) === SHIP_THREAD && String(row.message_id) === SHIP_MSG,
  );
  const hits: {
    threadId: string;
    messageId: string;
    sourceRef: string;
    sentAt: string;
    subject: string | null;
    fromHash: string | null;
    own: boolean;
    excerpt: string;
  }[] = [];
  for (const row of evidence) {
    const split = splitOwnAndQuotedText(row.plaintext ?? null);
    const own = haystackOf(row.indexed.subject, split.own || null);
    if (!specValueEstablishedInText(own, fieldName || "finger_size", proposed || "11")) {
      continue;
    }
    const excerpt =
      exactSpecSpanInText(own, fieldName || "finger_size", proposed || "11") ??
      spanAround(own, "finger size 11") ??
      spanAround(own, "ring size 11") ??
      clip(own);
    hits.push({
      threadId: row.indexed.threadId,
      messageId: row.indexed.messageId,
      sourceRef: `gc1|${row.indexed.threadId}|${row.indexed.messageId}`,
      sentAt: row.indexed.sentAt,
      subject: row.indexed.subject,
      fromHash: row.fromEmailHash ?? row.indexed.fromEmailHash,
      own: true,
      excerpt,
    });
  }

  const shippingOwn = shipping
    ? haystackOf(
        shipping.indexed.subject,
        splitOwnAndQuotedText(shipping.plaintext ?? null).own || null,
      )
    : String(indexedShipping?.subject ?? "");
  const shippingQuoted = shipping
    ? splitOwnAndQuotedText(shipping.plaintext ?? null).quoted
    : "";
  const shippingEstablishes = specValueEstablishedInText(
    shippingOwn,
    fieldName || "finger_size",
    proposed || "11",
  );
  const shippingQuotedHas = specValueEstablishedInText(
    shippingQuoted,
    fieldName || "finger_size",
    proposed || "11",
  );

  const exactHit = hits.length === 1 ? hits[0]! : null;
  const bodiesFetched = Boolean(fetched && fetched.ok);
  const report = {
    candidateId: candidate.candidateId,
    sourceRef: candidate.sourceRef,
    sourceTimestamp: candidate.sourceTimestamp,
    reviewStatus,
    candidateState,
    fieldName,
    proposedValue: proposed,
    currentValue: payload.kind === "structured_spec" ? payload.currentValue : null,
    storedProvenance:
      payload.kind === "structured_spec" ? payload.sourceProvenance ?? null : null,
    matchedText: candidate.evidenceBasis.matchedText,
    ruleIds: candidate.evidenceBasis.ruleIds,
    bodiesFetched,
    gmailFetchError,
    shipping: {
      present: Boolean(shipping || indexedShipping),
      establishesProposed: shippingEstablishes,
      quotedContainsProposed: shippingQuotedHas,
      subject: shipping?.indexed.subject ?? indexedShipping?.subject ?? null,
    },
    indexedSubjects: (indexedRows ?? []).map((row) => ({
      threadId: String(row.thread_id),
      messageId: String(row.message_id),
      sentAt: String(row.sent_at),
      subject: row.subject == null ? null : String(row.subject),
      subjectEstablishes: specValueEstablishedInText(
        String(row.subject ?? ""),
        fieldName || "finger_size",
        proposed || "11",
      ),
    })),
    exactHits: hits.map((row) => ({
      threadId: row.threadId,
      messageId: row.messageId,
      sourceRef: row.sourceRef,
      sentAt: row.sentAt,
      subject: row.subject,
      excerpt: row.excerpt,
    })),
    exactSourceFound: Boolean(exactHit),
    boundedThreadCount: threadIds.size,
    evidenceCount: evidence.length,
    chickenProjectIds: chickenIds,
    historyFingerSizes: (historyRows ?? []).map((row) => ({
      projectId: String(row.project_id),
      threadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
      fingerSize: row.finger_size == null ? null : String(row.finger_size),
    })),
    repairApplied: false,
  };

  if (repair) {
    if (!bodiesFetched && !exactHit) {
      const next = withStructuredSpecProvenance(candidate, "UNKNOWN");
      if (next.reviewStatus !== reviewStatus || next.candidateState !== candidateState) {
        process.stdout.write("TRAVIS_REPAIR_ABORTED review-state-changed\n");
        process.exit(2);
      }
      if (next.payload.kind !== "structured_spec" || next.payload.proposedValue !== proposed) {
        process.stdout.write("TRAVIS_REPAIR_ABORTED proposed-value-changed\n");
        process.exit(2);
      }
      const stored = candidateToRow(next);
      const { error: updateError } = await client
        .from(CONTINUUM_CANDIDATES_TABLE)
        .update({
          payload: stored.payload,
          evidence_basis: stored.evidence_basis,
        })
        .eq("candidate_id", TRAVIS_CANDIDATE_ID)
        .eq("review_status", reviewStatus)
        .eq("candidate_state", candidateState);
      if (updateError) {
        process.stdout.write(`TRAVIS_REPAIR_FAILED ${updateError.code ?? "update-failed"}\n`);
        process.exit(2);
      }
      report.repairApplied = true;
      report.storedProvenance = "UNKNOWN";
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    const next = exactHit
      ? withStructuredSpecProvenance(candidate, "EXACT", {
          sourceRef: exactHit.sourceRef,
        })
      : withStructuredSpecProvenance(
          candidate,
          shippingQuotedHas ? "THREAD_SUPPORT" : "UNKNOWN",
        );
    if (next.reviewStatus !== reviewStatus || next.candidateState !== candidateState) {
      process.stdout.write("TRAVIS_REPAIR_ABORTED review-state-changed\n");
      process.exit(2);
    }
    if (next.payload.kind !== "structured_spec" || next.payload.proposedValue !== proposed) {
      process.stdout.write("TRAVIS_REPAIR_ABORTED proposed-value-changed\n");
      process.exit(2);
    }
    const stored = candidateToRow(next);
    const { error: updateError } = await client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .update({
        source_ref: stored.source_ref,
        payload: stored.payload,
        evidence_basis: stored.evidence_basis,
      })
      .eq("candidate_id", TRAVIS_CANDIDATE_ID)
      .eq("review_status", reviewStatus)
      .eq("candidate_state", candidateState);
    if (updateError) {
      process.stdout.write(`TRAVIS_REPAIR_FAILED ${updateError.code ?? "update-failed"}\n`);
      process.exit(2);
    }
    report.repairApplied = true;
    report.storedProvenance =
      next.payload.kind === "structured_spec" ? next.payload.sourceProvenance ?? null : null;
    report.sourceRef = next.sourceRef;
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main();
