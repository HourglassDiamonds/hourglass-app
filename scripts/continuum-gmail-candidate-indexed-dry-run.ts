/**
 * REAL #16B indexed-Gmail Candidate acceptance (read-only).
 * Usage: npx tsx scripts/continuum-gmail-candidate-indexed-dry-run.ts
 *
 * Loads the existing Gmail index + current eight Projects.
 * Does not fetch Gmail, decrypt mailbox tokens, write candidates,
 * or mutate Person/Project/spec/Open Job/canonical state.
 *
 * This is not the eight-project fixture dry-run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS,
  INDEXED_EIGHT_PROJECT_KEYS,
  presentIndexedEightProjectAcceptance,
  type IndexedEightProjectKey,
} from "../lib/continuum/gmail/candidates/indexed-dry-run";
import type {
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "../lib/continuum/gmail/candidates/types";
import { GMAIL_SOURCE_SYSTEM } from "../lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "../lib/continuum/client-memory/gmail/types";
import type { PersonRole } from "../lib/continuum/client-memory/types";

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

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.local"));

const MESSAGE_COLUMNS =
  "message_id, thread_id, sent_at, indexed_at, subject, from_email_hash, to_email_hashes, cc_email_hashes, bcc_email_hashes, direction, label_ids, has_attachments, source_system";

const TITLE_MATCHERS: Record<IndexedEightProjectKey, RegExp> = {
  pennock: /pennock/i,
  leeSpiegel: /spiegel/i,
  travis: /travis/i,
  sarah: /leishman/i,
  dylan: /doerner/i,
  chelsea: /binder/i,
  madi: /rutledge/i,
  kaitlin: /west\s+[—-]\s+wedding band/i,
};

const CAD_TOKENS: Record<IndexedEightProjectKey, string | null> = {
  pennock: null,
  leeSpiegel: null,
  travis: null,
  sarah: "563876",
  dylan: null,
  chelsea: "CR5001024",
  madi: "C017756",
  kaitlin: "C017755",
};

const SUBJECT_TOKENS: Record<IndexedEightProjectKey, readonly string[]> = {
  pennock: [],
  leeSpiegel: [],
  travis: [],
  sarah: ["563876"],
  dylan: ["Doerner"],
  chelsea: ["CR5001024"],
  madi: ["C017756"],
  kaitlin: ["C017755"],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function rowToMessage(row: Record<string, unknown>): GmailIndexedMessage {
  return {
    messageId: String(row.message_id),
    threadId: String(row.thread_id),
    sentAt: String(row.sent_at),
    indexedAt: String(row.indexed_at),
    subject: row.subject == null ? null : String(row.subject),
    fromEmailHash: row.from_email_hash == null ? null : String(row.from_email_hash),
    toEmailHashes: asStringArray(row.to_email_hashes),
    ccEmailHashes: asStringArray(row.cc_email_hashes),
    bccEmailHashes: asStringArray(row.bcc_email_hashes),
    direction:
      row.direction === "outbound" || row.direction === "inbound"
        ? row.direction
        : "unknown",
    labelIds: asStringArray(row.label_ids),
    hasAttachments: Boolean(row.has_attachments),
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function escapeIlike(token: string): string {
  return token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function asPersonRole(value: unknown): PersonRole | null {
  const roles = Array.isArray(value) ? value.map(String) : [];
  const allowed: PersonRole[] = [
    "client",
    "prospect",
    "vendor-contact",
    "personal",
    "family",
    "friend",
    "business-contact",
  ];
  return allowed.find((role) => roles.includes(role)) ?? null;
}

function pickProject(
  key: IndexedEightProjectKey,
  rows: readonly {
    projectId: string;
    title: string;
    gmailThreadId: string | null;
    cadJobNumber: string | null;
  }[],
) {
  const cad = CAD_TOKENS[key];
  if (cad) {
    const byCad = rows.filter(
      (row) =>
        row.cadJobNumber &&
        row.cadJobNumber.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
          cad.replace(/[^a-z0-9]/gi, "").toLowerCase(),
    );
    if (byCad.length === 1) return byCad[0]!;
    if (byCad.length > 1) {
      return byCad.find((row) => TITLE_MATCHERS[key].test(row.title)) ?? byCad[0]!;
    }
  }
  const matched = rows.filter((row) => TITLE_MATCHERS[key].test(row.title));
  if (matched.length === 0) return null;
  const withThread = matched.find((row) => row.gmailThreadId);
  const withCad = matched.find((row) => row.cadJobNumber);
  return withThread ?? withCad ?? matched[0]!;
}

async function selectMessages(
  client: SupabaseClient,
  ids: readonly string[],
): Promise<GmailIndexedMessage[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("continuum_gmail_messages")
    .select(MESSAGE_COLUMNS)
    .in("message_id", [...ids]);
  if (error) throw error;
  return (data ?? []).map((row) => rowToMessage(row as Record<string, unknown>));
}

async function selectByThread(
  client: SupabaseClient,
  threadId: string,
): Promise<GmailIndexedMessage[]> {
  const { data, error } = await client
    .from("continuum_gmail_messages")
    .select(MESSAGE_COLUMNS)
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToMessage(row as Record<string, unknown>));
}

async function selectBySubjectTokens(
  client: SupabaseClient,
  tokens: readonly string[],
): Promise<GmailIndexedMessage[]> {
  const byId = new Map<string, GmailIndexedMessage>();
  for (const token of tokens) {
    const needle = escapeIlike(token.trim());
    if (needle.length < 2) continue;
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select(MESSAGE_COLUMNS)
      .ilike("subject", `%${needle}%`)
      .order("sent_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    for (const row of data ?? []) {
      const message = rowToMessage(row as Record<string, unknown>);
      byId.set(message.messageId, message);
    }
  }
  return [...byId.values()];
}

async function selectTouchingHash(
  client: SupabaseClient,
  hash: string,
): Promise<GmailIndexedMessage[]> {
  const byId = new Map<string, GmailIndexedMessage>();
  const { data: fromRows, error: fromError } = await client
    .from("continuum_gmail_messages")
    .select(MESSAGE_COLUMNS)
    .eq("from_email_hash", hash)
    .limit(50);
  if (fromError) throw fromError;
  for (const row of fromRows ?? []) {
    const message = rowToMessage(row as Record<string, unknown>);
    byId.set(message.messageId, message);
  }
  for (const column of ["to_email_hashes", "cc_email_hashes", "bcc_email_hashes"] as const) {
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select(MESSAGE_COLUMNS)
      .contains(column, [hash])
      .limit(50);
    if (error) throw error;
    for (const row of data ?? []) {
      const message = rowToMessage(row as Record<string, unknown>);
      byId.set(message.messageId, message);
    }
  }
  return [...byId.values()];
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    process.stdout.write("INDEXED_DRY_RUN_UNAVAILABLE supabase-unconfigured\n");
    process.exit(2);
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: historyRows, error: historyError } = await client
    .from("continuum_project_history")
    .select(
      "project_id, cad_job_number, order_number, gmail_thread_id, finger_size, metal, center_stone, diamond_supply_notes",
    );
  if (historyError) {
    process.stdout.write(`INDEXED_DRY_RUN_UNAVAILABLE ${historyError.code ?? "query-failed"}\n`);
    process.exit(2);
  }
  const { data: profileRows, error: profileError } = await client
    .from("continuum_project_profiles")
    .select("project_id, display_title");
  if (profileError) {
    process.stdout.write(`INDEXED_DRY_RUN_UNAVAILABLE ${profileError.code ?? "query-failed"}\n`);
    process.exit(2);
  }
  const { data: relRows, error: relError } = await client
    .from("continuum_relationships")
    .select("from_entity_id, to_entity_id, kind, status");
  if (relError) {
    process.stdout.write(`INDEXED_DRY_RUN_UNAVAILABLE ${relError.code ?? "query-failed"}\n`);
    process.exit(2);
  }

  const titles = new Map<string, string>();
  for (const row of profileRows ?? []) {
    titles.set(String(row.project_id), String(row.display_title ?? ""));
  }
  const peopleByProject = new Map<string, string[]>();
  const projectsByPerson = new Map<string, string[]>();
  for (const row of relRows ?? []) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    const projectId = String(row.to_entity_id);
    const personId = String(row.from_entity_id);
    const list = peopleByProject.get(projectId) ?? [];
    list.push(personId);
    peopleByProject.set(projectId, list);
    const projects = projectsByPerson.get(personId) ?? [];
    projects.push(projectId);
    projectsByPerson.set(personId, projects);
  }

  const catalog = (historyRows ?? []).map((row) => ({
    projectId: String(row.project_id),
    title: titles.get(String(row.project_id)) ?? String(row.project_id),
    gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
    cadJobNumber: row.cad_job_number == null ? null : String(row.cad_job_number),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    fingerSize: row.finger_size == null ? null : String(row.finger_size),
    metal: row.metal == null ? null : String(row.metal),
    centerStone: row.center_stone == null ? null : String(row.center_stone),
    diamondSupplyNotes:
      row.diamond_supply_notes == null ? null : String(row.diamond_supply_notes),
  }));

  const selected = new Map<IndexedEightProjectKey, (typeof catalog)[number]>();
  for (const key of INDEXED_EIGHT_PROJECT_KEYS) {
    const hit = pickProject(key, catalog);
    if (hit) selected.set(key, hit);
  }

  const projectIds = [...selected.values()].map((row) => row.projectId);
  const personIds = [
    ...new Set(projectIds.flatMap((id) => peopleByProject.get(id) ?? [])),
  ];

  const { data: personRows } = personIds.length
    ? await client
        .from("continuum_person_profiles")
        .select("person_id, display_name, roles")
        .in("person_id", personIds)
    : { data: [] };
  const { data: identityRows } = personIds.length
    ? await client
        .from("continuum_external_identities")
        .select("entity_id, identity_kind, identifier, revoked_at")
        .in("entity_id", personIds)
        .eq("identity_kind", "email_hash")
        .is("revoked_at", null)
    : { data: [] };

  const emailHashByPerson = new Map<string, string | null>();
  for (const row of identityRows ?? []) {
    emailHashByPerson.set(String(row.entity_id), String(row.identifier));
  }

  const people: GmailCandidatePerson[] = (personRows ?? []).map((row) => ({
    personId: String(row.person_id),
    displayName: String(row.display_name ?? row.person_id),
    emailHash: emailHashByPerson.get(String(row.person_id)) ?? null,
    role: asPersonRole(row.roles),
    projectIds: projectsByPerson.get(String(row.person_id)) ?? [],
  }));

  const projects: GmailCandidateProject[] = [...selected.values()].map((row) => ({
    projectId: row.projectId,
    title: row.title,
    gmailThreadId: row.gmailThreadId,
    cadJobNumber: row.cadJobNumber,
    orderNumber: row.orderNumber,
    fingerSize: row.fingerSize,
    metal: row.metal,
    centerStone: row.centerStone,
    diamondSupplyNotes: row.diamondSupplyNotes,
    personIds: peopleByProject.get(row.projectId) ?? [],
    founderApprovedCurrent: true,
  }));

  const world: GmailCandidateWorld = {
    people,
    projects,
    internalEmailHashes: [],
  };

  const knownIds = Object.values(INDEXED_EIGHT_KNOWN_MESSAGE_IDS);
  const byId = new Map<string, GmailIndexedMessage>();
  for (const message of await selectMessages(client, knownIds)) {
    byId.set(message.messageId, message);
  }
  const extraMessageIdsByKey: Partial<Record<IndexedEightProjectKey, string[]>> = {};
  for (const key of INDEXED_EIGHT_PROJECT_KEYS) {
    const extras = extraMessageIdsByKey[key] ?? [];
    const project = selected.get(key);
    if (project?.gmailThreadId) {
      for (const message of await selectByThread(client, project.gmailThreadId)) {
        byId.set(message.messageId, message);
        if (!knownIds.includes(message.messageId as (typeof knownIds)[number])) {
          extras.push(message.messageId);
        }
      }
    }
    for (const message of await selectBySubjectTokens(client, SUBJECT_TOKENS[key])) {
      byId.set(message.messageId, message);
      if (!knownIds.includes(message.messageId as (typeof knownIds)[number])) {
        extras.push(message.messageId);
      }
    }
    const hashes = (peopleByProject.get(project?.projectId ?? "") ?? [])
      .map((personId) => emailHashByPerson.get(personId))
      .filter((hash): hash is string => Boolean(hash));
    for (const hash of hashes) {
      const touching = (await selectTouchingHash(client, hash))
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
        .slice(-12);
      for (const message of touching) {
        byId.set(message.messageId, message);
        if (!knownIds.includes(message.messageId as (typeof knownIds)[number])) {
          extras.push(message.messageId);
        }
      }
    }
    extraMessageIdsByKey[key] = [...new Set(extras)];
  }

  const projectIdsByKey: Partial<Record<IndexedEightProjectKey, string | null>> = {};
  for (const key of INDEXED_EIGHT_PROJECT_KEYS) {
    projectIdsByKey[key] = selected.get(key)?.projectId ?? null;
  }

  const acceptance = presentIndexedEightProjectAcceptance({
    world,
    messages: [...byId.values()],
    projectIdsByKey,
    extraMessageIdsByKey,
    createdAt: new Date().toISOString(),
  });

  const report = {
    kind: "real-16b-indexed-gmail-acceptance",
    fixture: false,
    indexOnly: acceptance.indexOnly,
    gmailFetch: acceptance.gmailFetch,
    plaintextUsed: acceptance.plaintextUsed,
    liveModelCalls: acceptance.liveModelCalls,
    mutationBoundary: acceptance.mutationBoundary,
    knownMessages: knownIds.map((messageId) => {
      const message = byId.get(messageId) ?? null;
      return {
        messageId,
        presentInIndex: Boolean(message),
        sourceSystem: message ? "gmail" : null,
        sourceRef: message ? `gc1|${message.threadId}|${message.messageId}` : null,
        sourceTimestamp: message?.sentAt ?? null,
        plaintextAvailable: false,
        subjectPresent: Boolean(message?.subject?.trim()),
      };
    }),
    projects: acceptance.projects.map((row) => ({
      projectKey: row.projectKey,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      cadJobNumber: selected.get(row.projectKey)?.cadJobNumber ?? null,
      gmailThreadId: selected.get(row.projectKey)?.gmailThreadId ?? null,
      indexedEvidenceCount: row.indexedEvidence.length,
      indexedEvidence: row.indexedEvidence.map((hit) => ({
        messageId: hit.messageId,
        sourceSystem: hit.sourceSystem,
        sourceRef: hit.sourceRef,
        sourceTimestamp: hit.sourceTimestamp,
        plaintextAvailable: hit.plaintextAvailable,
        subjectPresent: hit.subjectPresent,
        hasAttachments: hit.hasAttachments,
        associationBasis: hit.associationBasis,
      })),
      emittedCandidates: row.emittedCandidates,
      notEmittedBecauseIndexLacksContent: row.notEmittedBecauseIndexLacksContent,
    })),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main();
