/**
 * Attach structured_spec provenance from exact Gmail evidence.
 * An exact Gmail sourceRef is eligible only when this message's own text
 * establishes the proposed value. Quoted, reconstructed, or sibling-thread
 * context must not be stamped as EXACT.
 */

import type {
  ContinuumCandidate,
  ContinuumCandidateDraft,
  StructuredSpecSourceProvenance,
} from "@/lib/continuum/candidates/types";
import { clipMatchedText } from "@/lib/continuum/candidates/identity";
import { candidateHasGeneratedOperatingMailRule } from "./generated-source";
import {
  extractStructuredSpecs,
  haystackOf,
} from "./parse";
import { packGmailCandidateSourceRef, parseGmailCandidateSourceRef } from "./source-ref";
import { cloneEvidenceBasis } from "./supporting-source";
import type { GmailCandidateEvidence } from "./types";

export const QUOTED_HISTORICAL_EVIDENCE_RULE = "quoted_historical_evidence";
export const HISTORICAL_QUOTED_IDENTIFIER_RULE = "historical_quoted_identifier";

const QUOTE_LINE = /^(?:>+|│)\s?/;
const ON_WROTE = /^On\s.{1,400}wrote:\s*$/i;
const WROTE_ONLY = /^wrote:\s*$/i;
const EMAIL_WROTE = /<[^>\s]+@[^>\s]+>\s*wrote:\s*$/i;
const ORIGINAL_MESSAGE = /^[-_]{2,}\s*Original Message[-_]{2,}\s*$/i;
const FORWARDED = /^Begin forwarded message:\s*$/i;
const FORWARDED_GMAIL = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
const OUTLOOK_FROM = /^From:\s.+/i;
const OUTLOOK_SENT = /^(?:Sent|Date):\s.+/i;

function nearbyLine(lines: readonly string[], index: number, offset: number): string {
  return (lines[index + offset] ?? "").trim();
}

function isQuoteBoundary(lines: readonly string[], index: number): boolean {
  const line = lines[index]!;
  const trimmed = line.trim();
  if (QUOTE_LINE.test(line.trimStart())) return true;
  if (
    ON_WROTE.test(trimmed) ||
    ORIGINAL_MESSAGE.test(trimmed) ||
    FORWARDED.test(trimmed) ||
    FORWARDED_GMAIL.test(trimmed)
  ) {
    return true;
  }
  if (EMAIL_WROTE.test(trimmed) && !/^I\b/i.test(trimmed)) return true;
  if (WROTE_ONLY.test(trimmed) && /^On\s/i.test(nearbyLine(lines, index, -1))) return true;
  if (/^On\s/i.test(trimmed) && !/wrote:\s*$/i.test(trimmed)) {
    const next = nearbyLine(lines, index, 1);
    const next2 = nearbyLine(lines, index, 2);
    if (WROTE_ONLY.test(next) || /wrote:\s*$/i.test(next) || WROTE_ONLY.test(next2) || /wrote:\s*$/i.test(next2)) {
      return true;
    }
  }
  if (OUTLOOK_FROM.test(trimmed) && OUTLOOK_SENT.test(nearbyLine(lines, index, 1))) {
    return true;
  }
  return false;
}

export function authorOwnedText(plaintext: string | null | undefined): string {
  return splitOwnAndQuotedText(plaintext).own;
}

export function quotedText(plaintext: string | null | undefined): string {
  return splitOwnAndQuotedText(plaintext).quoted;
}

export function authorOwnedHaystack(
  subject: string | null,
  plaintext: string | null,
): string {
  return haystackOf(subject, splitOwnAndQuotedText(plaintext).own || null);
}

export function splitOwnAndQuotedText(plaintext: string | null | undefined): {
  own: string;
  quoted: string;
} {
  const text = plaintext ?? "";
  if (!text.trim()) return { own: "", quoted: "" };
  const lines = text.split(/\r?\n/);
  const own: string[] = [];
  const quoted: string[] = [];
  let inQuote = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!inQuote && isQuoteBoundary(lines, index)) inQuote = true;
    if (inQuote) quoted.push(line);
    else own.push(line);
  }
  return { own: own.join("\n").trim(), quoted: quoted.join("\n").trim() };
}

export function isQuotedHistoricalCandidate(
  row: Pick<ContinuumCandidate, "payload" | "evidenceBasis">,
): boolean {
  if (row.evidenceBasis.ruleIds.includes(QUOTED_HISTORICAL_EVIDENCE_RULE)) return true;
  if (row.evidenceBasis.ruleIds.includes(HISTORICAL_QUOTED_IDENTIFIER_RULE)) return true;
  if (row.payload.kind === "project_context" && row.payload.topic.startsWith("historical_")) {
    return true;
  }
  if (row.payload.kind === "structured_spec" && row.payload.sourceProvenance === "THREAD_SUPPORT") {
    return true;
  }
  const matched = (row.evidenceBasis.matchedText ?? "").replace(/\s+/g, " ").trim();
  if (!matched) return false;
  const split = splitOwnAndQuotedText(
    `${row.evidenceBasis.matchedText ?? ""}\n${
      row.payload.kind === "note"
        ? row.payload.text
        : row.payload.kind === "open_job"
          ? row.payload.detail ?? row.payload.subject
          : row.payload.kind === "project_context"
            ? row.payload.value
            : ""
    }`,
  );
  if (!split.quoted) return false;
  const needle = matched.toLowerCase();
  return split.quoted.toLowerCase().includes(needle) && !split.own.toLowerCase().includes(needle);
}

export function specValueEstablishedInText(
  text: string,
  fieldName: string,
  proposedValue: string,
): boolean {
  const want = proposedValue.trim().toLowerCase();
  if (!want) return false;
  return extractStructuredSpecs(text, null).some(
    (hit) =>
      hit.fieldName === fieldName &&
      hit.proposedValue.trim().toLowerCase() === want,
  );
}

export function exactSpecSpanInText(
  text: string,
  fieldName: string,
  proposedValue: string,
): string | null {
  const want = proposedValue.trim().toLowerCase();
  if (!want) return null;
  const hit = extractStructuredSpecs(text, null).find(
    (row) =>
      row.fieldName === fieldName &&
      row.proposedValue.trim().toLowerCase() === want,
  );
  return hit ? clipMatchedText(hit.matchedText) : null;
}

function ownHaystack(row: GmailCandidateEvidence): string {
  const split = splitOwnAndQuotedText(row.plaintext ?? null);
  return haystackOf(row.indexed.subject, split.own || null);
}

function quotedHaystack(row: GmailCandidateEvidence): string {
  return splitOwnAndQuotedText(row.plaintext ?? null).quoted;
}

function fullHaystack(row: GmailCandidateEvidence): string {
  return haystackOf(row.indexed.subject, row.plaintext ?? null);
}

function evidenceBySourceRef(
  evidence: readonly GmailCandidateEvidence[],
): Map<string, GmailCandidateEvidence> {
  const map = new Map<string, GmailCandidateEvidence>();
  for (const row of evidence) {
    const packed = packGmailCandidateSourceRef({
      threadId: row.indexed.threadId,
      messageId: row.indexed.messageId,
    });
    if (!packed.ok) continue;
    map.set(packed.sourceRef, row);
  }
  return map;
}

function threadMates(
  evidence: readonly GmailCandidateEvidence[],
  threadId: string,
): GmailCandidateEvidence[] {
  return evidence.filter((row) => row.indexed.threadId === threadId);
}

function classify(input: {
  draft: ContinuumCandidateDraft;
  trigger: GmailCandidateEvidence | null;
  thread: readonly GmailCandidateEvidence[];
}): {
  provenance: StructuredSpecSourceProvenance;
  sourceRef: string;
  sourceTimestamp: string;
  matchedText: string | null;
  supportingSourceRefs: string[] | undefined;
} {
  const payload = input.draft.payload;
  const fieldName = payload.kind === "structured_spec" ? payload.fieldName : "";
  const proposedValue =
    payload.kind === "structured_spec" ? payload.proposedValue : "";
  const generated = candidateHasGeneratedOperatingMailRule(
    input.draft.evidenceBasis.ruleIds,
  );
  if (generated || input.trigger?.reconstructed === true) {
    return {
      provenance: "DERIVED",
      sourceRef: input.draft.sourceRef,
      sourceTimestamp: input.draft.sourceTimestamp,
      matchedText: input.draft.evidenceBasis.matchedText,
      supportingSourceRefs: input.draft.evidenceBasis.supportingSourceRefs
        ? [...input.draft.evidenceBasis.supportingSourceRefs]
        : undefined,
    };
  }
  if (!input.trigger) {
    return {
      provenance: "UNKNOWN",
      sourceRef: input.draft.sourceRef,
      sourceTimestamp: input.draft.sourceTimestamp,
      matchedText: input.draft.evidenceBasis.matchedText,
      supportingSourceRefs: undefined,
    };
  }

  const own = ownHaystack(input.trigger);
  if (specValueEstablishedInText(own, fieldName, proposedValue)) {
    return {
      provenance: "EXACT",
      sourceRef: input.draft.sourceRef,
      sourceTimestamp: input.draft.sourceTimestamp,
      matchedText:
        exactSpecSpanInText(own, fieldName, proposedValue) ??
        input.draft.evidenceBasis.matchedText,
      supportingSourceRefs: undefined,
    };
  }

  const exactOthers = input.thread.filter((row) => {
    if (row.indexed.messageId === input.trigger!.indexed.messageId) return false;
    if (row.reconstructed === true) return false;
    return specValueEstablishedInText(
      ownHaystack(row),
      fieldName,
      proposedValue,
    );
  });
  if (exactOthers.length === 1) {
    const exact = exactOthers[0]!;
    const packed = packGmailCandidateSourceRef({
      threadId: exact.indexed.threadId,
      messageId: exact.indexed.messageId,
    });
    if (packed.ok) {
      return {
        provenance: "EXACT",
        sourceRef: packed.sourceRef,
        sourceTimestamp: exact.indexed.sentAt,
        matchedText:
          exactSpecSpanInText(ownHaystack(exact), fieldName, proposedValue) ??
          input.draft.evidenceBasis.matchedText,
        supportingSourceRefs: undefined,
      };
    }
  }
  if (exactOthers.length > 1) {
    const supporting = exactOthers.flatMap((row) => {
      const packed = packGmailCandidateSourceRef({
        threadId: row.indexed.threadId,
        messageId: row.indexed.messageId,
      });
      return packed.ok ? [packed.sourceRef] : [];
    });
    return {
      provenance: "THREAD_SUPPORT",
      sourceRef: input.draft.sourceRef,
      sourceTimestamp: input.draft.sourceTimestamp,
      matchedText: input.draft.evidenceBasis.matchedText,
      supportingSourceRefs: supporting.length > 0 ? supporting : undefined,
    };
  }

  const quoted = quotedHaystack(input.trigger);
  if (
    specValueEstablishedInText(quoted, fieldName, proposedValue) ||
    specValueEstablishedInText(fullHaystack(input.trigger), fieldName, proposedValue)
  ) {
    return {
      provenance: "THREAD_SUPPORT",
      sourceRef: input.draft.sourceRef,
      sourceTimestamp: input.draft.sourceTimestamp,
      matchedText: input.draft.evidenceBasis.matchedText,
      supportingSourceRefs: undefined,
    };
  }

  return {
    provenance: "UNKNOWN",
    sourceRef: input.draft.sourceRef,
    sourceTimestamp: input.draft.sourceTimestamp,
    matchedText: input.draft.evidenceBasis.matchedText,
    supportingSourceRefs: undefined,
  };
}

export function attachStructuredSpecProvenance(
  drafts: readonly ContinuumCandidateDraft[],
  evidence: readonly GmailCandidateEvidence[],
): ContinuumCandidateDraft[] {
  const byRef = evidenceBySourceRef(evidence);
  return drafts.map((draft) => {
    if (draft.payload.kind !== "structured_spec") return draft;
    const parsed = parseGmailCandidateSourceRef(draft.sourceRef);
    const trigger = byRef.get(draft.sourceRef) ?? null;
    const thread = parsed ? threadMates(evidence, parsed.threadId) : [];
    const classified = classify({ draft, trigger, thread });
    const payload = draft.payload;
    const nextPayload = {
      ...payload,
      sourceProvenance: classified.provenance,
    };
    const sameRef = classified.sourceRef === draft.sourceRef;
    const sameStamp = classified.sourceTimestamp === draft.sourceTimestamp;
    const sameMatch =
      classified.matchedText === draft.evidenceBasis.matchedText;
    const currentSupport = draft.evidenceBasis.supportingSourceRefs ?? [];
    const nextSupport = classified.supportingSourceRefs ?? [];
    const sameSupport =
      currentSupport.length === nextSupport.length &&
      currentSupport.every((ref, index) => ref === nextSupport[index]);
    if (
      payload.sourceProvenance === classified.provenance &&
      sameRef &&
      sameStamp &&
      sameMatch &&
      sameSupport
    ) {
      return draft;
    }
    return {
      ...draft,
      sourceRef: classified.sourceRef,
      sourceTimestamp: classified.sourceTimestamp,
      payload: nextPayload,
      evidenceBasis: {
        ...cloneEvidenceBasis(draft.evidenceBasis),
        matchedText: classified.matchedText,
        supportingSourceRefs: classified.supportingSourceRefs,
      },
    };
  });
}
