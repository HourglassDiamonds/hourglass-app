/**
 * READ-ONLY Production Today replay.
 * Feeds current continuum_* rows through composeCosOperatingLoop + composeTodayDocket.
 * Prints sanitized semantic traces only. Does not write. Does not persist bodies.
 *
 * Usage: npm run continuum:today-replay
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { collectExactGmailIds } from "../lib/continuum/candidates/exact-gmail-ids";
import { collectPagedRows } from "../lib/continuum/candidates/page";
import { rowToCandidate } from "../lib/continuum/candidates/rows";
import { CONTINUUM_CANDIDATES_TABLE } from "../lib/continuum/candidates/activation";
import type { ContinuumCandidate } from "../lib/continuum/candidates/types";
import type {
  TodayGmailIndexedMessage,
  TodayGmailThreadContext,
  TodayKnownPerson,
} from "../lib/continuum/candidates/founder-attention";
import { hashEmail, hashStoredPersonEmail } from "../lib/continuum/client-memory/hashes";
import { loadProjectJobs } from "../lib/continuum/client-memory/project-jobs/load";
import { composeCosOperatingLoop } from "../lib/continuum/chief-of-staff/operating-loop/compose";
import { loadFounderCorrectionEvents } from "../lib/continuum/chief-of-staff/operating-loop/founder-corrections-load";
import { candidateDispositionCorrectionEvents } from "../lib/continuum/concierge-sol/founder-command";
import { composeTodayDocket } from "../lib/continuum/chief-of-staff/operating-loop/docket";
import { finalizeTodayDocket } from "../lib/continuum/chief-of-staff/operating-loop/today-docket-boundary";
import { parseGmailWebHref } from "../lib/continuum/chief-of-staff/operating-loop/evidence";
import type { CosProjectContext } from "../lib/continuum/chief-of-staff/operating-loop/types";
import { generatedOperatingMailHashesFromEnv } from "../lib/continuum/gmail/candidates/generated-source";
import { INDEXED_EIGHT_KNOWN_MESSAGE_IDS } from "../lib/continuum/gmail/candidates/indexed-dry-run";
import { parseGmailCandidateSourceRef } from "../lib/continuum/gmail/candidates/source-ref";
import { withIndexedGeneratedOperatingMail } from "../lib/continuum/gmail/candidates/tag-stored-generated";
import { classifyTodayLiveThreadFrontier } from "../lib/continuum/gmail/today-required-thread-set";
import { createLiveGmailApi } from "../lib/continuum/gmail/adapter";
import { createSupabaseGmailIndexStore } from "../lib/continuum/client-memory/gmail/supabase";
import { createSupabaseGmailConnectionStore } from "../lib/continuum/gmail/supabase";
import { runIndexedThreadEvidenceFetch } from "../lib/continuum/gmail/indexed-thread-evidence";
import { liveGmailAccessTokenRefresher } from "../lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "../lib/continuum/gmail/token-crypto";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { projectGmailSourceEvents } from "../lib/continuum/source-events/gmail";
import type { SourceCommunicationEvent } from "../lib/continuum/source-events/types";
import { readTodaySourceWatermark } from "../lib/continuum/today-source-watermark";
import { watermarkToken } from "../lib/continuum/today-snapshot";

const CHUNK = 40;
const MESSAGES_PER_THREAD = 80;
const INDEX_SELECT =
  "thread_id, message_id, sent_at, direction, subject, label_ids, from_email_hash, has_attachments";
const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;

function unassignedLiveIdentityThreadIds(
  docket: ReturnType<typeof finalizeTodayDocket>,
  loop: ReturnType<typeof composeCosOperatingLoop>,
): string[] {
  const ids = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (id) ids.add(id);
  };
  const addHref = (href: string | null | undefined) => {
    const ref = href ?? "";
    add(
      parseGmailCandidateSourceRef(ref)?.threadId ??
        parseGmailWebHref(ref)?.threadId,
    );
  };
  for (const item of docket.upNext) {
    const unresolved =
      item.subject === "Unassigned" ||
      item.briefingPacket?.entityType === "unknown" ||
      Boolean(
        item.brief &&
          !item.brief.personLabel &&
          !item.brief.organizationLabel,
      );
    if (!unresolved) continue;
    add(item.brief?.recoveredGmailThreadId);
    add(item.brief?.canonicalGmailThreadId);
    for (const beat of item.brief?.evidence ?? []) {
      if (beat.generatedSource !== true) addHref(beat.sourceHref);
    }
    for (const action of item.brief?.actions ?? []) {
      if (action.kind === "open_email") addHref(action.href);
    }
    addHref(item.decision?.sourceHref);
  }
  for (const item of docket.watching) {
    if (item.briefingPacket?.entityType !== "unknown") continue;
    for (const ref of item.briefingPacket.sourceRefs) addHref(ref);
    for (const event of item.briefingPacket.sourceEvents ?? []) {
      add(event.threadId);
      addHref(event.sourceRef);
    }
  }
  return [...ids].filter(
    (threadId) =>
      loop.threadContext?.get(threadId)?.liveEnrichmentAttempted !== true,
  );
}

function priorBroadIdentityThreadIds(
  loop: ReturnType<typeof composeCosOperatingLoop>,
): string[] {
  const ids = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (id) ids.add(id);
  };
  const addRef = (value: string | null | undefined) => {
    const ref = value ?? "";
    add(
      parseGmailCandidateSourceRef(ref)?.threadId ??
        parseGmailWebHref(ref)?.threadId,
    );
  };
  for (const item of composeTodayDocket(loop).items) {
    const unresolved =
      item.subject === "Unassigned" ||
      (!item.brief?.personLabel && !item.brief?.organizationLabel);
    if (!unresolved) continue;
    add(item.brief?.recoveredGmailThreadId);
    add(item.brief?.canonicalGmailThreadId);
    for (const beat of item.brief?.evidence ?? []) {
      if (beat.generatedSource !== true) addRef(beat.sourceHref);
    }
    for (const action of item.brief?.actions ?? []) {
      if (action.kind === "open_email") addRef(action.href);
    }
    addRef(item.decision?.sourceHref);
  }
  for (const brief of loop.brief) {
    if (brief.personLabel || brief.organizationLabel) continue;
    add(brief.recoveredGmailThreadId);
    add(brief.canonicalGmailThreadId);
  }
  return [...ids];
}

const PROOF_MESSAGES = [
  { id: "1a0c52c12690a0f5", label: "Dylon", cad: "C025610" },
  { id: "1a0b18dcd27676a1", label: "Tim/Jenn", cad: "C025964" },
  { id: "1a0cb2ce180a3f78", label: "Sarah", cad: "C026143" },
  { id: "1a0ca8e67de67c17", label: "Nathan client", cad: "C026176" },
  { id: "1a0caed66950d9f3", label: "Nathan founder", cad: "C026176" },
  { id: "1a0ca7810946b8fe", label: "F. Grant", cad: "C025885" },
  { id: "1a0ca88c2aa0bd2f", label: "Duane", cad: "C026350" },
  { id: "1a0caff66376da79", label: "Abbey", cad: "C026137" },
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
      if (key.endsWith("_SUPABASE_URL") && !process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = val;
      }
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.local"));

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`missing-${name}`);
  return value;
}

function clip(value: string | null | undefined, max = 120): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function founderHashes(): Set<string> {
  const hashes = new Set<string>();
  const founder = process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL?.trim();
  const extras = (process.env.CONTINUUM_GMAIL_INTERNAL_ADDRESSES ?? "")
    .split(/[,\s]+/)
    .map((row) => row.trim())
    .filter(Boolean);
  for (const email of [founder, ...extras, "justin@hourglassdiamonds.com"]) {
    const hash = hashEmail(email ?? "")?.toLowerCase();
    if (hash) hashes.add(hash);
  }
  return hashes;
}

function indexedDirection(
  value: unknown,
  fromEmailHash: string | null,
  hashes: ReadonlySet<string>,
): TodayGmailIndexedMessage["direction"] {
  if (value === "outbound") return "outbound";
  if (value === "inbound") return "inbound";
  const hash = fromEmailHash?.trim().toLowerCase() ?? "";
  if (hash && hashes.has(hash)) return "outbound";
  if (hash) return "inbound";
  return "unknown";
}

async function loadKnownPeople(client: SupabaseClient): Promise<TodayKnownPerson[]> {
  const [{ data: profiles }, { data: identities }] = await Promise.all([
    client
      .from("continuum_person_profiles")
      .select("person_id, display_name, roles, organization_name, email"),
    client
      .from("continuum_external_identities")
      .select("entity_id, identity_kind, identifier, revoked_at")
      .eq("identity_kind", "email_hash"),
  ]);
  const byPerson = new Map<string, TodayKnownPerson>();
  for (const row of profiles ?? []) {
    const personId = String(row.person_id ?? "").trim();
    const displayName = String(row.display_name ?? "").trim();
    if (!personId || !displayName) continue;
    const fromEmail = hashStoredPersonEmail(
      row.email == null ? null : String(row.email),
    );
    byPerson.set(personId, {
      personId,
      displayName,
      roles: Array.isArray(row.roles) ? row.roles.map((role) => String(role)) : [],
      organizationName:
        row.organization_name == null ? null : String(row.organization_name),
      emailHash: fromEmail ?? "",
    });
  }
  for (const row of identities ?? []) {
    if (row.revoked_at) continue;
    const personId = String(row.entity_id ?? "").trim();
    const hash = String(row.identifier ?? "").trim().toLowerCase();
    if (!personId || !EMAIL_HASH_RE.test(hash)) continue;
    const existing = byPerson.get(personId);
    if (!existing) continue;
    if (!existing.emailHash) existing.emailHash = hash;
  }
  return [...byPerson.values()].filter((row) => EMAIL_HASH_RE.test(row.emailHash));
}

async function loadProjects(client: SupabaseClient): Promise<Map<string, CosProjectContext>> {
  const [
    { data: profiles },
    { data: histories },
    { data: lifecycleStates },
    { data: people },
    { data: relationships },
  ] =
    await Promise.all([
      client
        .from("continuum_project_profiles")
        .select("project_id, display_title"),
      client
        .from("continuum_project_history")
        .select("project_id, gmail_thread_id, cad_job_number"),
      client
        .from("continuum_project_lifecycle_states")
        .select("project_id, stage"),
      client
        .from("continuum_person_profiles")
        .select("person_id, display_name, roles, organization_name"),
      client
        .from("continuum_relationships")
        .select("from_entity_id, to_entity_id, kind, status")
        .eq("kind", "client-project")
        .eq("status", "active"),
    ]);
  const peopleById = new Map(
    (people ?? []).map((row) => [
      String(row.person_id),
      {
        personId: String(row.person_id),
        displayName: String(row.display_name ?? ""),
        role: Array.isArray(row.roles) && row.roles.includes("vendor-contact")
          ? "vendor-contact"
          : Array.isArray(row.roles)
            ? String(row.roles[0] ?? "")
            : null,
        organizationName:
          row.organization_name == null ? null : String(row.organization_name),
      },
    ]),
  );
  const peopleByProject = new Map<string, CosProjectContext["people"]>();
  for (const row of relationships ?? []) {
    const projectId = String(row.to_entity_id ?? "").trim();
    const person = peopleById.get(String(row.from_entity_id ?? "").trim());
    if (!projectId || !person) continue;
    const list = [...(peopleByProject.get(projectId) ?? [])];
    if (!list.some((item) => item.personId === person.personId)) list.push(person);
    peopleByProject.set(projectId, list);
  }
  const historyByProject = new Map(
    (histories ?? []).map((row) => [String(row.project_id), row]),
  );
  const lifecycleByProject = new Map(
    (lifecycleStates ?? []).map((row) => [String(row.project_id), String(row.stage ?? "")]),
  );
  const map = new Map<string, CosProjectContext>();
  for (const row of profiles ?? []) {
    const projectId = String(row.project_id ?? "").trim();
    if (!projectId) continue;
    const history = historyByProject.get(projectId);
    const peopleForProject = peopleByProject.get(projectId) ?? [];
    const client = peopleForProject.find((person) => person.role !== "vendor-contact");
    map.set(projectId, {
      projectId,
      title: String(row.display_title ?? ""),
      personName: client?.displayName ?? null,
      people: peopleForProject,
      isCurrent: true,
      lifecycleStage: lifecycleByProject.get(projectId) || null,
      gmailThreadId:
        history?.gmail_thread_id == null ? null : String(history.gmail_thread_id),
    });
  }
  return map;
}

async function loadIndexedThreadContext(
  client: SupabaseClient,
  candidates: readonly ContinuumCandidate[],
): Promise<Map<string, TodayGmailThreadContext>> {
  const ids = collectExactGmailIds(candidates);
  const out = new Map<string, TodayGmailThreadContext>();
  const hashes = founderHashes();
  const ingest = (data: readonly Record<string, unknown>[]) => {
    const recovered: string[] = [];
    for (const row of data) {
      const threadId = String(row.thread_id ?? "").trim();
      if (!threadId) continue;
      if (!out.has(threadId)) recovered.push(threadId);
      const existing = out.get(threadId) ?? {};
      const messages = [...(existing.messages ?? [])];
      const messageId = String(row.message_id ?? "").trim();
      const sentAt = String(row.sent_at ?? "").trim();
      if (
        messageId &&
        sentAt &&
        messages.length < MESSAGES_PER_THREAD &&
        !messages.some((item) => item.messageId === messageId)
      ) {
        const fromEmailHash =
          row.from_email_hash == null ? null : String(row.from_email_hash);
        messages.push({
          messageId,
          sentAt,
          direction: indexedDirection(row.direction, fromEmailHash, hashes),
          labelIds: Array.isArray(row.label_ids)
            ? row.label_ids.map((item) => String(item)).filter(Boolean)
            : undefined,
          fromEmailHash,
          subject: row.subject == null ? null : String(row.subject),
          hasAttachments: Boolean(row.has_attachments),
        });
      }
      out.set(threadId, {
        subject: existing.subject ?? (row.subject == null ? null : String(row.subject)),
        messages,
        attachmentFilenames: existing.attachmentFilenames,
      });
    }
    return recovered;
  };
  const loadThreads = async (threadIds: readonly string[]) => {
    for (let index = 0; index < threadIds.length; index += CHUNK) {
      const chunk = threadIds.slice(index, index + CHUNK);
      try {
        const data = await collectPagedRows(async (from, to) => {
          const { data: page, error } = await client
            .from("continuum_gmail_messages")
            .select(INDEX_SELECT)
            .in("thread_id", chunk)
            .order("sent_at", { ascending: false })
            .order("message_id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (page ?? []) as Record<string, unknown>[];
        });
        ingest(data);
      } catch {
        continue;
      }
    }
  };
  await loadThreads(ids.threadIds);
  const seen = new Set(
    [...out.values()].flatMap((thread) => (thread.messages ?? []).map((row) => row.messageId)),
  );
  const orphans = ids.messageIds.filter((id) => !seen.has(id));
  const recovered: string[] = [];
  for (let index = 0; index < orphans.length; index += CHUNK) {
    const chunk = orphans.slice(index, index + CHUNK);
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select(INDEX_SELECT)
      .in("message_id", chunk);
    if (error || !data) continue;
    recovered.push(...ingest(data as Record<string, unknown>[]).filter((id) => !out.has(id) || true));
  }
  const extra = [...out.keys()].filter((id) => !ids.threadIds.includes(id));
  if (extra.length > 0) await loadThreads(extra);
  for (let index = 0; index < [...out.keys()].length; index += CHUNK) {
    const chunk = [...out.keys()].slice(index, index + CHUNK);
    let data: Record<string, unknown>[];
    try {
      data = await collectPagedRows(async (from, to) => {
        const { data: page, error } = await client
          .from("continuum_gmail_attachments")
          .select("thread_id, message_id, filename")
          .in("thread_id", chunk)
          .order("thread_id", { ascending: true })
          .order("message_id", { ascending: true })
          .order("filename", { ascending: true })
          .range(from, to);
        if (error) throw new Error(error.message);
        return (page ?? []) as Record<string, unknown>[];
      });
    } catch {
      continue;
    }
    const byThread = new Map<string, string[]>();
    const byMessage = new Map<string, string[]>();
    for (const row of data) {
      const threadId = String(row.thread_id ?? "").trim();
      const messageId = String(row.message_id ?? "").trim();
      const filename = String(row.filename ?? "").trim();
      if (!threadId || !filename) continue;
      const threadList = byThread.get(threadId) ?? [];
      if (!threadList.includes(filename)) threadList.push(filename);
      byThread.set(threadId, threadList);
      if (messageId) {
        const key = `${threadId}|${messageId}`;
        const list = byMessage.get(key) ?? [];
        if (!list.includes(filename)) list.push(filename);
        byMessage.set(key, list);
      }
    }
    for (const [threadId, filenames] of byThread) {
      const existing = out.get(threadId);
      if (!existing) continue;
      out.set(threadId, {
        ...existing,
        messages: (existing.messages ?? []).map((message) => {
          const extraFiles = byMessage.get(`${threadId}|${message.messageId}`) ?? [];
          if (extraFiles.length === 0) return message;
          return {
            ...message,
            hasAttachments: true,
            attachmentFilenames: [...new Set([...(message.attachmentFilenames ?? []), ...extraFiles])],
          };
        }),
        attachmentFilenames: [...new Set([...(existing.attachmentFilenames ?? []), ...filenames])],
      });
    }
  }
  return out;
}

async function tagGenerated(
  client: SupabaseClient,
  candidates: readonly ContinuumCandidate[],
): Promise<ContinuumCandidate[]> {
  const hashes = generatedOperatingMailHashesFromEnv();
  const messageIds = [
    ...new Set(
      candidates
        .map((row) => parseGmailCandidateSourceRef(row.sourceRef)?.messageId.trim() ?? "")
        .filter(Boolean),
    ),
  ];
  const fromHash = new Map<string, string | null>();
  for (let index = 0; index < messageIds.length; index += 100) {
    const chunk = messageIds.slice(index, index + 100);
    const { data } = await client
      .from("continuum_gmail_messages")
      .select("message_id, from_email_hash")
      .in("message_id", chunk);
    for (const row of data ?? []) {
      fromHash.set(
        String(row.message_id),
        row.from_email_hash == null ? null : String(row.from_email_hash),
      );
    }
  }
  return withIndexedGeneratedOperatingMail(candidates, fromHash, hashes);
}

function hayOf(row: {
  subject?: string | null;
  headline?: string | null;
  title?: string | null;
  detail?: string | null;
  context?: string | null;
  briefingPacket?: { displayName?: string | null; projectName?: string | null } | null;
  briefing?: { displayName?: string; headline?: string; stand?: string } | null;
}): string {
  return [
    row.subject,
    row.headline,
    row.title,
    row.detail,
    row.context,
    row.briefingPacket?.displayName,
    row.briefingPacket?.projectName,
    row.briefing?.displayName,
    row.briefing?.headline,
    row.briefing?.stand,
  ]
    .filter(Boolean)
    .join(" ");
}

function sanitizeEvent(event: SourceCommunicationEvent) {
  return {
    messageId: event.messageId,
    threadId: event.threadId,
    timestamp: event.timestamp,
    direction: event.direction,
    actor: event.actor,
    semanticClass: event.semanticClass,
    subject: clip(event.subject),
    cadIds: event.cadIds,
    orderIds: event.orderIds,
    productionJobIds: event.productionJobIds,
    hasAttachments: event.hasAttachments,
    attachmentFilenames: event.attachmentFilenames.slice(0, 8),
    provenance: event.provenance,
  };
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error("replay-refuses-non-production-supabase");
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const rawRows = await collectPagedRows(async (from, to) => {
    const { data, error } = await client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .select("*")
      .order("created_at", { ascending: true })
      .order("candidate_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const listed: ContinuumCandidate[] = [];
  for (const row of rawRows) {
    try {
      listed.push(rowToCandidate(row as Record<string, unknown>));
    } catch {
      /* skip malformed */
    }
  }
  const [candidates, jobs, projects, knownPeople, noteCorrections] = await Promise.all([
    tagGenerated(client, listed),
    loadProjectJobs(client),
    loadProjects(client),
    loadKnownPeople(client),
    loadFounderCorrectionEvents(client),
  ]);
  const founderCorrections = [
    ...noteCorrections,
    ...candidateDispositionCorrectionEvents(candidates),
  ];
  const threadContext = await loadIndexedThreadContext(client, candidates);
  const sourceEvents = projectGmailSourceEvents({
    threadContext,
    knownPeople,
    founderEmailHashes: founderHashes(),
    candidates,
  });
  sourceEvents.push(...founderCorrections);
  const loop = composeCosOperatingLoop({
    founderCorrections,
    jobs: jobs ?? [],
    candidates,
    projects,
    nowIso: new Date().toISOString(),
    threadContext,
    knownPeople,
    vendorDirectory: ["vlora"],
  });
  const docket = composeTodayDocket(loop);
  const finalized = finalizeTodayDocket(loop);
  const frontier = classifyTodayLiveThreadFrontier({
    ...finalized,
    candidates,
    associatedGmailThreadsByProject: loop.associatedGmailThreadsByProject,
    unresolvedIdentityThreadIds: unassignedLiveIdentityThreadIds(finalized, loop),
    priorBroadIdentityThreadIds: priorBroadIdentityThreadIds(loop),
  });
  const upNext = docket.items.map((item) => ({
    subject: item.subject,
    headline: clip(item.headline),
    ball: item.briefingPacket?.ballHolder ?? null,
    next: item.briefingPacket?.semanticNextActionClass ?? null,
    chip: item.briefing?.stateChip ?? null,
  }));
  const watching = docket.watching.map((item) => ({
    title: item.title,
    detail: clip(item.detail),
    ball: item.briefingPacket?.ballHolder ?? null,
    next: item.briefingPacket?.semanticNextActionClass ?? null,
    chip: item.briefing?.stateChip ?? null,
  }));
  const named = (needle: RegExp) => {
    const item =
      docket.items.find((row) => needle.test(hayOf(row))) ??
      finalized.upNext.find((row) => needle.test(hayOf(row)));
    const watch = docket.watching.find((row) => needle.test(hayOf(row)));
    return {
      lane: item ? "up_next" : watch ? "watching" : "absent",
      ball: item?.briefingPacket?.ballHolder ?? watch?.briefingPacket?.ballHolder ?? null,
      next:
        item?.briefingPacket?.semanticNextActionClass ??
        watch?.briefingPacket?.semanticNextActionClass ??
        null,
      copy: clip(
        item
          ? `${item.subject} — ${item.headline}`
          : watch
            ? `${watch.title} — ${watch.detail}`
            : null,
        180,
      ),
    };
  };
  const proofs = {
    dylon: named(/Dylon|C025610/i),
    grant: named(/Grant|C025885|SP13477/i),
    duane: named(/Duane|C026350/i),
    sarah: named(/Sarah|S\.?\s*Leishman|C026143/i),
    nathan: named(/Nate|Nathan|C026176|Dagger/i),
    tim: named(/Tim|Jenn|C025964/i),
    madi: named(/\bMadi\b|C026000|C017756/i),
    abbey: named(/Abbey|C026137/i),
    jesse: named(/\bJesse\b/i),
  };
  const traces = PROOF_MESSAGES.map((proof) => {
    const event = sourceEvents.find((row) => row.messageId === proof.id) ?? null;
    return {
      label: proof.label,
      cad: proof.cad,
      messageId: proof.id,
      indexed: Boolean(event),
      event: event ? sanitizeEvent(event) : null,
    };
  });
  const failures: string[] = [];
  const expect = (
    ok: boolean,
    label: string,
  ) => {
    if (!ok) failures.push(label);
  };
  expect(proofs.dylon.lane === "watching" && proofs.dylon.ball === "vendor_shop", "dylon-vendor-shop");
  expect(!/send me the stl/i.test(proofs.dylon.copy ?? ""), "dylon-no-old-stl-copy");
  expect(proofs.grant.lane === "watching" && proofs.grant.ball === "vendor_shop", "grant-vendor-shop");
  expect(proofs.grant.ball !== "client", "grant-not-client-wait");
  expect(proofs.duane.lane === "watching" && proofs.duane.ball === "vendor_shop", "duane-vendor-shop");
  expect(
    proofs.sarah.lane === "watching" && proofs.sarah.ball === "vendor_shop",
    "sarah-vendor-shop",
  );
  expect(!/price|timeline|next steps/i.test(proofs.sarah.copy ?? ""), "sarah-no-generic-copy");
  expect(proofs.nathan.lane === "watching" && proofs.nathan.ball === "vendor_shop", "nathan-vendor-shop");
  expect(
    proofs.tim.lane === "watching" &&
      proofs.tim.ball === "vendor_shop" &&
      !/place order/i.test(proofs.tim.copy ?? ""),
    "tim-in-production",
  );
  expect(proofs.madi.lane === "watching" && proofs.madi.ball === "client", "madi-client-wait");
  expect(proofs.jesse.lane === "absent", "jesse-absent");
  const result = {
    verdict: failures.length === 0 ? "PASS" : "BLOCK",
    failures,
    counts: {
      candidates: candidates.length,
      threads: threadContext.size,
      sourceEvents: sourceEvents.length,
      jobs: jobs?.length ?? 0,
      projects: projects.size,
    },
    upNext,
    watching,
    proofs,
    traces,
  };
  if (process.argv.includes("--current-truth-audit")) {
    const targetThreads = new Set(["19fdca0abe1a7e3e", "19ffcce49298efeb"]);
    const eventTrace = (event: SourceCommunicationEvent) => ({
      sourceRef: event.sourceRef,
      timestamp: event.timestamp,
      actor: event.actor,
      semanticClass: event.semanticClass,
      cadIds: event.cadIds,
      orderIds: event.orderIds,
      productionJobIds: event.productionJobIds,
      projectId: event.projectId,
      threadId: event.threadId,
      provenance: event.provenance,
      correction: event.correction ?? null,
    });
    const timEvents = sourceEvents
      .filter((event) => event.cadIds.includes("C025964"))
      .map(eventTrace);
    const travisEvents = sourceEvents
      .filter((event) => Boolean(event.threadId && targetThreads.has(event.threadId)))
      .map(eventTrace);
    const ids = new Set(
      [...timEvents, ...travisEvents]
        .flatMap((event) => [event.sourceRef, event.threadId])
        .filter((value): value is string => Boolean(value)),
    );
    const relatedCandidates = candidates
      .filter((row) => {
        const ref = parseGmailCandidateSourceRef(row.sourceRef);
        return (
          ids.has(row.sourceRef) ||
          Boolean(ref && (ids.has(ref.threadId) || ids.has(ref.messageId)))
        );
      })
      .map((row) => ({
        candidateId: row.candidateId,
        sourceRef: row.sourceRef,
        sourceTimestamp: row.sourceTimestamp,
        candidateType: row.candidateType,
        candidateState: row.candidateState,
        reviewStatus: row.reviewStatus,
        ruleIds: row.evidenceBasis.ruleIds,
        payloadKind: row.payload.kind,
        projectId: "projectId" in row.payload ? row.payload.projectId ?? null : null,
        waitingOnActor:
          row.payload.kind === "open_job" ? row.payload.waitingOnActor : null,
      }));
    const auditRows = [
      ...docket.items.map((item) => ({
        lane: "up_next",
        id: item.id,
        title: item.subject,
        projectId: item.briefingPacket?.projectId ?? item.brief?.projectId ?? null,
        stage: item.briefingPacket?.projection?.stage ?? null,
        dependency: item.briefingPacket?.candidateNextAction ?? null,
        ballHolder: item.briefingPacket?.ballHolder ?? null,
        asOf: item.briefingPacket?.projection?.asOf ?? null,
        controllingSourceRefs: item.briefingPacket?.projection?.controllingSourceRefs ?? [],
      })),
      ...docket.watching.map((item) => ({
        lane: "watching",
        id: item.id,
        title: item.title,
        projectId: item.projectId ?? item.briefingPacket?.projectId ?? null,
        stage: item.briefingPacket?.projection?.stage ?? null,
        dependency: item.briefingPacket?.candidateNextAction ?? null,
        ballHolder: item.briefingPacket?.ballHolder ?? null,
        asOf: item.briefingPacket?.projection?.asOf ?? null,
        controllingSourceRefs: item.briefingPacket?.projection?.controllingSourceRefs ?? [],
      })),
    ];
    const projectIds = new Set(auditRows.map((row) => row.projectId).filter(Boolean));
    const jobAudit = (jobs ?? [])
      .filter((job) => !job.projectId || projectIds.has(job.projectId))
      .map((job) => ({
        jobId: job.jobId,
        projectId: job.projectId,
        state: job.state,
        kind: job.kind,
        waitingOnActor: job.waitingOnActor,
        attentionMode: job.attentionMode ?? "action",
        updatedAt: job.updatedAt,
        sourceSystem: job.sourceSystem,
        sourceRef: job.sourceRef,
      }));
    const [{ data: snapshotRows }, liveWatermark] = await Promise.all([
      client
        .from("continuum_today_snapshots")
        .select("read_model_version, source_watermark, composed_at, updated_at, payload")
        .eq("snapshot_key", "founder_today_v1")
        .limit(1),
      readTodaySourceWatermark(client),
    ]);
    const [timMail, travisKnown, travisProjects] = await Promise.all([
      client
        .from("continuum_gmail_messages")
        .select("thread_id, message_id, sent_at, direction, indexed_at, has_attachments")
        .or("subject.ilike.%C025964%,subject.ilike.%RN08318%")
        .order("sent_at", { ascending: true }),
      client
        .from("continuum_gmail_messages")
        .select("thread_id, message_id, sent_at, direction, indexed_at, has_attachments")
        .or(
          `message_id.in.(${INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travis},${INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travisVendor}),thread_id.in.(${INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travis},${INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travisVendor})`,
        )
        .order("sent_at", { ascending: true }),
      client
        .from("continuum_project_profiles")
        .select("project_id, updated_at")
        .or("display_title.ilike.%chick%,display_title.ilike.%travis%"),
    ]);
    const exactThreads = new Set<string>(
      [
        ...(timMail.data ?? []).slice(-1).map((row) => String(row.thread_id)),
        ...(travisKnown.data ?? []).map((row) => String(row.thread_id)),
      ].filter(Boolean),
    );
    const kek = loadGmailTokenKek();
    const fetched = kek.ok
      ? await runIndexedThreadEvidenceFetch({
          founderSessionOk: false,
          secretProtectedOk: true,
          threadIds: [...exactThreads],
          index: createSupabaseGmailIndexStore(client),
          connections: createSupabaseGmailConnectionStore(client),
          decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
          refreshAccessToken: (refreshToken) =>
            liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
          createApi: (accessToken) => createLiveGmailApi(accessToken),
        })
      : null;
    const liveContexts = new Map<string, TodayGmailThreadContext>();
    if (fetched?.ok) {
      for (const evidence of fetched.evidence) {
        const threadId = evidence.indexed.threadId;
        const current = liveContexts.get(threadId) ?? {
          subject: evidence.indexed.subject,
          messages: [],
        };
        liveContexts.set(threadId, {
          ...current,
          messages: [
            ...(current.messages ?? []),
            {
              messageId: evidence.indexed.messageId,
              sentAt: evidence.indexed.sentAt,
              direction: evidence.indexed.direction,
              labelIds: evidence.indexed.labelIds,
              fromEmailHash: evidence.indexed.fromEmailHash,
              subject: evidence.indexed.subject,
              hasAttachments: evidence.indexed.hasAttachments,
              attachmentFilenames: (evidence.attachments ?? [])
                .map((attachment) => attachment.filename)
                .filter((filename): filename is string => Boolean(filename)),
              plaintext: evidence.plaintext ?? null,
            },
          ],
        });
      }
    }
    const liveExactEvents = projectGmailSourceEvents({
      threadContext: liveContexts,
      knownPeople,
      founderEmailHashes: founderHashes(),
      candidates,
    }).map(eventTrace);
    const travisProjectIds = (travisProjects.data ?? []).map((row) => String(row.project_id));
    const [travisHistory, travisLifecycle, travisJobs] = await Promise.all([
      travisProjectIds.length
        ? client
            .from("continuum_project_history")
            .select("project_id, cad_job_number, order_number, gmail_thread_id, finger_size, updated_at")
            .in("project_id", travisProjectIds)
        : Promise.resolve({ data: [] }),
      travisProjectIds.length
        ? client
            .from("continuum_project_lifecycle_states")
            .select("project_id, stage, updated_at")
            .in("project_id", travisProjectIds)
        : Promise.resolve({ data: [] }),
      travisProjectIds.length
        ? client
            .from("continuum_project_jobs")
            .select("job_id, project_id, state, waiting_on_actor, updated_at, source_ref")
            .in("project_id", travisProjectIds)
        : Promise.resolve({ data: [] }),
    ]);
    const snapshot = snapshotRows?.[0] as Record<string, unknown> | undefined;
    const payload = snapshot?.payload as
      | { docket?: { items?: unknown[]; watching?: unknown[] } }
      | undefined;
    const snapshotTargets = [
      ...(payload?.docket?.items ?? []),
      ...(payload?.docket?.watching ?? []),
    ]
      .filter((row) => {
        const json = JSON.stringify(row);
        return (
          json.includes("449b8c0d-9c17-4beb-aa28-0b6db798f39d") ||
          /Travis|Chicker/i.test(json) ||
          /Tim\/Jenn|C025964/i.test(json)
        );
      })
      .map((row) => {
        const item = row as Record<string, unknown>;
        const packet = item.briefingPacket as Record<string, unknown> | undefined;
        const projection = packet?.projection as Record<string, unknown> | undefined;
        return {
          id: item.id ?? null,
          title: item.title ?? item.subject ?? null,
          headline: item.headline ?? null,
          detail: item.detail ?? null,
          projectId: item.projectId ?? packet?.projectId ?? null,
          ballHolder: packet?.ballHolder ?? null,
          stage: projection?.stage ?? null,
          dependency: packet?.candidateNextAction ?? null,
          asOf: projection?.asOf ?? null,
        };
      });
    const exactTruthOnly = process.argv.includes("--exact-truth-only");
    process.stderr.write(
      `${JSON.stringify(
        exactTruthOnly
          ? {
              productionReadOnly: true,
              indexedChronology: {
                tim: (timMail.data ?? []).slice(-8),
                travis: (travisKnown.data ?? []).slice(-40),
              },
              exactThreadFetch: {
                ok: fetched?.ok === true,
                unreadThreadCount: fetched?.ok ? fetched.unreadThreads.length : null,
                events: liveExactEvents,
              },
              travisProjects: travisProjects.data ?? [],
              travisCanonical: {
                history: travisHistory.data ?? [],
                lifecycle: travisLifecycle.data ?? [],
                jobs: travisJobs.data ?? [],
              },
              snapshotTargets,
            }
          : {
          productionReadOnly: true,
          live: { auditRows, jobs: jobAudit },
          timEvents: timEvents.slice(-30),
          travisEvents: travisEvents.slice(-30),
          relatedCandidateCount: relatedCandidates.length,
          relatedCandidates: relatedCandidates.slice(-60),
          founderCorrectionCount: founderCorrections.length,
          founderCorrections: founderCorrections.map(eventTrace).slice(-20),
          indexedChronology: {
            tim: (timMail.data ?? []).slice(-40),
            travis: (travisKnown.data ?? []).slice(-40),
          },
          exactThreadFetch: {
            ok: fetched?.ok === true,
            unreadThreadCount: fetched?.ok ? fetched.unreadThreads.length : null,
            events: liveExactEvents,
          },
          travisProjects: travisProjects.data ?? [],
          travisCanonical: {
            history: travisHistory.data ?? [],
            lifecycle: travisLifecycle.data ?? [],
            jobs: travisJobs.data ?? [],
          },
          snapshot: snapshot
            ? {
                readModelVersion: snapshot.read_model_version,
                sourceWatermarkMatches: watermarkToken(snapshot.source_watermark) === liveWatermark,
                composedAt: snapshot.composed_at,
                updatedAt: snapshot.updated_at,
                itemCount: payload?.docket?.items?.length ?? null,
                watchingCount: payload?.docket?.watching?.length ?? null,
              }
            : null,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (process.argv.includes("--frontier-summary")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          verdict: result.verdict,
          priorBroadThreadCount: frontier.priorBroadThreadCount,
          requiredThreadCount: frontier.requiredThreadIds.length,
          requiredMissingIndexedCount: frontier.requiredThreadIds.filter(
            (threadId) => !threadContext.has(threadId),
          ).length,
          counts: frontier.counts,
        },
        null,
        2,
      )}\n`,
    );
    if (failures.length > 0) process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
