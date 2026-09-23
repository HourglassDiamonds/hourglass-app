/**
 * Project SourceCommunicationEvent rows from indexed Gmail at read-time.
 * Does not write. Does not require useful Candidates.
 * Optional candidate overlay supplies author-owned snippets already stored
 * on the same message; quoted/historical candidates are ignored.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  collectTodayFounderEmailHashes,
  sourceMessageId,
  isSupplierOrSystemMailbox,
  type TodayGmailThreadContext,
  type TodayKnownPerson,
} from "@/lib/continuum/candidates/founder-attention";
import {
  authorOwnedText,
  isQuotedHistoricalCandidate,
  quotedText,
} from "@/lib/continuum/gmail/candidates/spec-provenance";
import { packGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import {
  currentCadTokensFromIdentityHay,
  parseHgdClientLabel,
  parseShopCadFilename,
} from "@/lib/continuum/candidates/work-loop-identity";
import { classifySourceCommunication } from "./classify";
import type {
  SourceCommunicationActor,
  SourceCommunicationEvent,
} from "./types";

const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;
const ORDER_ID = /\bSP\d{4,}\b/gi;
const RN_ID = /\bRN\d{4,}\b/gi;
const HGD_VENDOR_THREAD = /\bHGD\s*x\s+.+-C\d{5,}/i;

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

function matches(text: string, pattern: RegExp): string[] {
  return unique([...(text.match(pattern) ?? [])].map((row) => row.toUpperCase()));
}

function cadTokensFromText(text: string): string[] {
  return unique([
    ...currentCadTokensFromIdentityHay([text]),
    ...(text.match(/\bC\d{5,}\b/gi) ?? []).map((row) => row.toUpperCase()),
  ]);
}

function isIdentifierOnlyOverlay(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim().replace(/[.:]+$/, "");
  if (!trimmed) return true;
  return /^(?:C\d{5,}(?:-[A-Z0-9]+)?|[A-Z]{1,4}\d{4,}(?:-[A-Z0-9]+)?)$/i.test(
    trimmed,
  );
}

function candidateOverlayByMessage(
  candidates: readonly ContinuumCandidate[] | undefined,
): Map<string, { own: string[]; quoted: string[]; cadIds: string[] }> {
  const map = new Map<string, { own: string[]; quoted: string[]; cadIds: string[] }>();
  if (!candidates?.length) return map;
  for (const row of candidates) {
    if (isQuotedHistoricalCandidate(row)) continue;
    const messageId = sourceMessageId(row);
    if (!messageId) continue;
    const raw = `${row.evidenceBasis.matchedText ?? ""}\n${
      row.payload.kind === "note"
        ? row.payload.text
        : row.payload.kind === "open_job"
          ? `${row.payload.subject} ${row.payload.detail ?? ""}`
          : row.payload.kind === "project_context"
            ? row.payload.value
            : row.payload.kind === "structured_spec"
              ? `${row.payload.fieldName} ${row.payload.proposedValue}`
              : ""
    }`;
    const own = authorOwnedText(raw);
    const quoted = quotedText(raw);
    const current = map.get(messageId) ?? { own: [], quoted: [], cadIds: [] };
    if (own.trim() && !isIdentifierOnlyOverlay(own)) current.own.push(own.trim());
    if (quoted.trim()) current.quoted.push(quoted.trim());
    current.cadIds = unique([
      ...current.cadIds,
      ...cadTokensFromText(`${own}\n${quoted}\n${raw}`),
    ]);
    map.set(messageId, current);
  }
  return map;
}

function firstNameToken(value: string): string {
  return (value.split(/[\s/.]+/)[0] ?? "").replace(/[^a-z]/g, "");
}

function displayMatchesHgdClient(
  displayName: string | null | undefined,
  subject: string | null,
): boolean {
  const parsed = parseHgdClientLabel(subject);
  const display = (displayName ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const client = (parsed?.name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!display || !client || client === parsed?.cadId.toLowerCase()) return false;
  if (display === client || display.startsWith(client) || client.startsWith(display.split(" ")[0] ?? "")) {
    return true;
  }
  const displayFirst = firstNameToken(display);
  const clientFirst = firstNameToken(client);
  if (displayFirst.length < 3 || clientFirst.length < 3) return false;
  return (
    displayFirst.startsWith(clientFirst.slice(0, 3)) ||
    clientFirst.startsWith(displayFirst.slice(0, 3)) ||
    displayFirst.includes(clientFirst) ||
    clientFirst.includes(displayFirst)
  );
}

function actorOf(input: {
  direction: "inbound" | "outbound" | "unknown";
  fromEmailHash: string | null;
  fromEmail?: string | null;
  fromDisplayName?: string | null;
  founderHashes: ReadonlySet<string>;
  vendorHashes: ReadonlySet<string>;
  clientHashes: ReadonlySet<string>;
  subject: string | null;
}): SourceCommunicationActor {
  const hash = input.fromEmailHash?.trim().toLowerCase() ?? "";
  if (input.direction === "outbound") return "founder";
  if (hash && input.founderHashes.has(hash)) return "founder";
  if (hash && input.vendorHashes.has(hash)) return "vendor_shop";
  if (
    input.direction === "inbound" &&
    HGD_VENDOR_THREAD.test(input.subject ?? "")
  ) {
    if (displayMatchesHgdClient(input.fromDisplayName, input.subject)) return "client";
    return "vendor_shop";
  }
  if (hash && input.clientHashes.has(hash)) return "client";
  if (
    input.direction === "inbound" &&
    !hash &&
    isSupplierOrSystemMailbox(input.fromEmail)
  ) {
    return "system";
  }
  if (hash && input.direction === "inbound") return "client";
  if (input.direction === "inbound") return "client";
  return "unknown";
}

function personLabelOf(subject: string | null, files: readonly string[]): string | null {
  const fromSubject = parseHgdClientLabel(subject);
  if (fromSubject && fromSubject.name !== fromSubject.cadId) return fromSubject.name;
  for (const file of files) {
    const parsed = parseShopCadFilename(file);
    if (parsed && parsed.name !== parsed.cadId) return parsed.name;
  }
  return fromSubject?.name ?? null;
}

function workLoopIdOf(input: {
  projectId: string | null;
  cadIds: readonly string[];
  threadId: string | null;
}): string | null {
  if (input.projectId) return `project:${input.projectId}`;
  if (input.cadIds.length === 1) return `cad:${input.cadIds[0]}`;
  if (input.threadId) return `thread:${input.threadId}`;
  return null;
}

export function projectGmailSourceEvents(input: {
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  knownPeople?: readonly TodayKnownPerson[];
  founderEmailHashes?: ReadonlySet<string>;
  candidates?: readonly ContinuumCandidate[];
  projectIdByThread?: ReadonlyMap<string, string>;
}): SourceCommunicationEvent[] {
  const threads = input.threadContext;
  if (!threads || threads.size === 0) return [];
  const founderHashes = new Set(
    [...(input.founderEmailHashes ?? collectTodayFounderEmailHashes(input.knownPeople))].map(
      (row) => row.toLowerCase(),
    ),
  );
  const vendorHashes = new Set<string>();
  const clientHashes = new Set<string>();
  for (const person of input.knownPeople ?? []) {
    const hash = (person.emailHash ?? "").trim().toLowerCase();
    if (!EMAIL_HASH_RE.test(hash)) continue;
    const roles = person.roles ?? [];
    if (roles.includes("vendor-contact")) vendorHashes.add(hash);
    else clientHashes.add(hash);
  }
  const overlay = candidateOverlayByMessage(input.candidates);
  const events: SourceCommunicationEvent[] = [];
  for (const [threadId, thread] of threads) {
    const threadSubject = thread.subject ?? null;
    for (const message of thread.messages ?? []) {
      const subject = message.subject ?? threadSubject;
      const files = unique([
        ...(message.attachmentFilenames ?? []),
      ]);
      const overlayRow = overlay.get(message.messageId);
      const fromEmailHash = message.fromEmailHash?.trim() || null;
      const ownParts = unique([
        ...(overlayRow?.own ?? []),
        message.plaintext ? authorOwnedText(message.plaintext) : "",
        subject ?? "",
        ...files,
      ]);
      const quotedParts = unique([
        ...(overlayRow?.quoted ?? []),
        message.plaintext ? quotedText(message.plaintext) : "",
      ]);
      const authorOwned = ownParts.join("\n").trim();
      const quoted = quotedParts.join("\n").trim();
      const actor = actorOf({
        direction: message.direction,
        fromEmailHash,
        fromEmail: thread.fromEmail ?? null,
        fromDisplayName: thread.fromDisplayName ?? null,
        founderHashes,
        vendorHashes,
        clientHashes,
        subject,
      });
      const cadIds = unique([
        ...currentCadTokensFromIdentityHay([subject, authorOwned, ...files]),
        ...cadTokensFromText(authorOwned),
        ...(overlayRow?.cadIds ?? []),
      ]);
      const identityHay = [subject, authorOwned, ...files].join("\n");
      const semanticClass = classifySourceCommunication({
        actor,
        direction: message.direction,
        subject,
        authorOwnedText: authorOwned,
        quotedText: quoted,
        attachmentFilenames: files,
        hasAttachments: message.hasAttachments === true || files.length > 0,
      });
      const projectId = input.projectIdByThread?.get(threadId) ?? null;
      const packed = packGmailCandidateSourceRef({
        threadId,
        messageId: message.messageId,
      });
      events.push({
        sourceType: "gmail",
        sourceRef: packed.ok ? packed.sourceRef : `gc1|${threadId}|${message.messageId}`,
        messageId: message.messageId,
        threadId,
        timestamp: message.sentAt,
        direction: message.direction,
        actor,
        subject,
        authorOwnedText: authorOwned,
        quotedText: quoted,
        attachmentFilenames: files,
        hasAttachments: message.hasAttachments === true || files.length > 0,
        cadIds,
        orderIds: matches(identityHay, ORDER_ID),
        productionJobIds: matches(identityHay, RN_ID),
        personLabel: personLabelOf(subject, files),
        projectId,
        workLoopId: workLoopIdOf({ projectId, cadIds, threadId }),
        semanticClass,
        provenance: overlayRow ? "indexed_gmail+interpretation" : "indexed_gmail",
      });
    }
  }
  return propagateThreadIdentity(events).sort((left, right) => {
    const delta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
    if (delta !== 0) return delta;
    return (left.messageId ?? "").localeCompare(right.messageId ?? "");
  });
}

function propagateThreadIdentity(
  events: readonly SourceCommunicationEvent[],
): SourceCommunicationEvent[] {
  const byThread = new Map<string, SourceCommunicationEvent[]>();
  const unthreaded: SourceCommunicationEvent[] = [];
  for (const event of events) {
    const threadId = event.threadId?.trim() ?? "";
    if (!threadId) {
      unthreaded.push(event);
      continue;
    }
    const list = byThread.get(threadId) ?? [];
    list.push(event);
    byThread.set(threadId, list);
  }
  const out: SourceCommunicationEvent[] = [...unthreaded];
  for (const [threadId, rows] of byThread) {
    const subjectCads = unique(
      rows.flatMap((row) => currentCadTokensFromIdentityHay([row.subject])),
    );
    const inheritCads =
      subjectCads.length === 1
        ? subjectCads
        : unique(rows.flatMap((row) => row.cadIds)).length === 1
          ? unique(rows.flatMap((row) => row.cadIds))
          : subjectCads;
    const personLabel = rows.find((row) => row.personLabel)?.personLabel ?? null;
    const projectId = rows.find((row) => row.projectId)?.projectId ?? null;
    for (const row of rows) {
      const nextCads = unique([
        ...row.cadIds,
        ...(row.cadIds.length === 0 ? inheritCads : subjectCads),
      ]);
      out.push({
        ...row,
        cadIds: nextCads,
        personLabel: row.personLabel ?? personLabel,
        projectId: row.projectId ?? projectId,
        workLoopId: workLoopIdOf({
          projectId: row.projectId ?? projectId,
          cadIds: nextCads.length === 1 ? nextCads : inheritCads.length === 1 ? inheritCads : nextCads,
          threadId,
        }),
      });
    }
  }
  return out;
}

export function sourceEventsForWorkLoop(
  events: readonly SourceCommunicationEvent[],
  input: {
    key: string;
    threadIds?: readonly string[];
    cadIds?: readonly string[];
    projectId?: string | null;
    personLabel?: string | null;
  },
): SourceCommunicationEvent[] {
  const threads = new Set(input.threadIds ?? []);
  const cads = new Set((input.cadIds ?? []).map((row) => row.toUpperCase()));
  const projectId = input.projectId?.trim() || null;
  const keyCad = input.key.startsWith("cad:") ? input.key.slice(4).toUpperCase() : "";
  const keyThread = input.key.startsWith("thread:") ? input.key.slice(7) : "";
  const keyProject = input.key.startsWith("project:") ? input.key.slice(8) : "";
  const person = (input.personLabel ?? "").trim().split(/[\s/]/)[0]?.toLowerCase() ?? "";
  if (keyCad) cads.add(keyCad);
  if (keyThread) threads.add(keyThread);
  if (keyProject && !projectId) {
    /* project key without id on events still matches projectId field */
  }
  return events.filter((event) => {
    if (projectId && event.projectId === projectId) return true;
    if (keyProject && event.projectId === keyProject) return true;
    if (event.threadId && threads.has(event.threadId)) return true;
    if (event.cadIds.some((cad) => cads.has(cad))) return true;
    if (event.workLoopId && event.workLoopId === input.key) return true;
    if (person.length >= 3 && event.personLabel) {
      const label = event.personLabel.trim().split(/[\s/]/)[0]?.toLowerCase() ?? "";
      if (label === person || label.startsWith(person) || person.startsWith(label)) return true;
    }
    return false;
  });
}
