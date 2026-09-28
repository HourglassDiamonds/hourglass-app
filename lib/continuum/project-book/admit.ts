/**
 * Project Book evidence admission.
 * Trusted chronology requires a trusted association.
 * Founder-facing rows use the semantic class and meaningful filenames.
 * Message bodies stay internal and are never returned for display.
 */

import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import type { SourceCommunicationEventClass } from "@/lib/continuum/source-events/types";
import type { ProjectBookSourceRecord } from "./types";

export const PROJECT_HISTORY_NEEDS_REVIEW =
  "Possible Gmail evidence exists, but Continuum has not confirmed that it belongs to this project.";

const FIELD_KEY = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/;
const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const SOURCE_REF = /gc1\|/i;
const QUOTE_MARKER =
  /\bOn\s.{0,180}wrote:|Begin forwarded message:|Forwarded message|Original Message|^>+\s/im;
const NOISE_FILE =
  /^(?:image\d+|logo\d*|spacer\d*|pixel\d*|tracking\d*|signature\d*|banner\d*|icon\d*|untitled|unnamed|noname|unnamed inline image)(?:[-_.\s]\d+)?(?:\.[a-z0-9]+)?$/i;
const INLINE_IMAGE = /^image\d+\.(?:jpe?g|png|gif|webp|svg)$/i;

const DISTRUST =
  /do not guess|don't guess|do-not-guess|ambiguous identity|multiple [^.\n]{0,80}clients|conflicting project/i;

export function projectHistoryDistrust(input: {
  matchJudgmentRaw?: string | null;
  noteTexts?: readonly string[];
}): boolean {
  const hay = [input.matchJudgmentRaw ?? "", ...(input.noteTexts ?? [])].join("\n");
  return DISTRUST.test(hay);
}

export function projectThreadAssociationTrust(input: {
  matchJudgment: string | null | undefined;
  matchJudgmentRaw?: string | null;
  noteTexts?: readonly string[];
}): "trusted" | "needs_review" {
  const judgment = (input.matchJudgment ?? "").trim().toLowerCase();
  if (
    judgment === "ambiguous" ||
    judgment === "no-exact" ||
    judgment === "malformed-source-value"
  ) {
    return "needs_review";
  }
  if (projectHistoryDistrust(input)) return "needs_review";
  return "trusted";
}

export function meaningfulAttachmentNames(filenames: readonly string[]): string[] {
  const kept: string[] = [];
  for (const name of filenames) {
    const file = name.trim();
    if (!file || isNoiseAttachment(file)) continue;
    if (founderCopyUnsafe(file)) continue;
    if (!kept.includes(file)) kept.push(file);
  }
  return kept;
}

export function isNoiseAttachment(filename: string): boolean {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? filename.trim();
  if (!base) return true;
  if (INLINE_IMAGE.test(base) || NOISE_FILE.test(base)) return true;
  if (/^(?:outlook-)?[a-z0-9]{0,8}logo\.(?:png|jpe?g|gif)$/i.test(base)) return true;
  return false;
}

export function attachmentLabels(filenames: readonly string[]): string[] {
  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const name of meaningfulAttachmentNames(filenames)) {
    if (/\.stl\b|\bstl\b/i.test(name)) add("STL");
    if (/NL-H017-|\bcad\b/i.test(name)) add("CAD");
    else if (/quote/i.test(name)) add("Quote");
    else if (/invoice/i.test(name)) add("Invoice");
    else if (/order|confirmation|\bSP\d{4,}\b/i.test(name)) add("Order confirmation");
    else if (/render/i.test(name)) add("Render");
    else if (/spec/i.test(name)) add("Spec");
  }
  return labels;
}

function folded(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function founderCopyUnsafe(value: string | null | undefined): boolean {
  const text = value ?? "";
  if (!text.trim()) return false;
  if (SOURCE_REF.test(text) || UUID.test(text) || FIELD_KEY.test(text) || QUOTE_MARKER.test(text)) {
    return true;
  }
  if (hasRepeatedPassage(text)) return true;
  const stripped = text
    .replace(/\bC\d{5,}\b/gi, " ")
    .replace(/\bSP\d{4,}\b/gi, " ")
    .replace(/\bRN\d{4,}\b/gi, " ");
  return /\b[0-9a-f]{16,}\b/i.test(stripped);
}

export function safeFounderCopy(value: string | null | undefined): string | null {
  const text = folded(value ?? "");
  if (!text || founderCopyUnsafe(text)) return null;
  return text.slice(0, 180);
}

function hasRepeatedPassage(text: string): boolean {
  const clean = folded(text);
  if (clean.length < 48) return false;
  const parts = clean.split(/(?<=[.!])\s+/);
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (key.length < 24) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  const half = Math.floor(clean.length / 2);
  const left = clean.slice(0, half).trim().toLowerCase();
  const right = clean.slice(half).trim().toLowerCase();
  return left.length >= 24 && (left === right || right.startsWith(left.slice(0, 40)));
}

const FILE_SUPPORTED_CLASS = new Set<SourceCommunicationEventClass>([
  "vendor_delivers_artifact",
  "vendor_order_confirmation",
  "workshop_started",
]);

export const PROJECT_FILE_RECEIVED = "Project file received";

export function isLowSignalClass(
  semanticClass: SourceCommunicationEventClass | null,
): boolean {
  return (
    semanticClass == null ||
    semanticClass === "client_replies_nonblocking" ||
    semanticClass === "vendor_acknowledges" ||
    semanticClass === "unknown_communication"
  );
}

export function normalizedSubject(value: string | null | undefined): string | null {
  let text = folded(value ?? "");
  if (!text) return null;
  for (let guard = 0; guard < 6 && /^(?:re|fw|fwd)\s*:\s*/i.test(text); guard += 1) {
    text = text.replace(/^(?:re|fw|fwd)\s*:\s*/i, "").trim();
  }
  if (!text || founderCopyUnsafe(text) || isNoiseAttachment(text)) return null;
  if (/^(?:thanks|thank you|thank you so much)[!.]*$/i.test(text)) return null;
  return text.slice(0, 180);
}

export function semanticSummary(semanticClass: SourceCommunicationEventClass | null): string {
  switch (semanticClass) {
    case "client_requests":
      return "Client requested a change or follow-up";
    case "client_approves":
      return "Client approved the design";
    case "founder_fulfills_commitment":
      return "Founder completed the requested follow-up";
    case "founder_requests_vendor":
      return "Founder sent the current request to the shop";
    case "founder_updates_client":
      return "Founder sent an update to the client";
    case "vendor_promises":
      return "Shop provided a timing commitment";
    case "vendor_delivers_artifact":
      return "Shop delivered project files";
    case "vendor_order_confirmation":
      return "Shop confirmed the order";
    case "workshop_started":
      return "Workshop production started";
    default:
      return PROJECT_FILE_RECEIVED;
  }
}

export type AdmittedProjectEvidence = {
  render: boolean;
  own: string;
  files: readonly string[];
  summary: string;
  excerpt: null;
  subject: string | null;
};

/**
 * Trusted display admission for one already-associated record.
 * A contaminated body never becomes copy. A meaningful filename can still
 * produce one restrained timeline row.
 */
export function admitProjectEvidence(record: ProjectBookSourceRecord): AdmittedProjectEvidence {
  const files = meaningfulAttachmentNames(record.attachmentFilenames);
  const raw = folded(record.authorOwnedText);
  const own = folded(authorOwnedText(record.authorOwnedText));
  const strippedQuote = Boolean(raw) && !own;
  const contaminated = Boolean(own) && founderCopyUnsafe(own);
  const low = isLowSignalClass(record.semanticClass);
  const fileSupported =
    record.semanticClass != null && FILE_SUPPORTED_CLASS.has(record.semanticClass);
  const unsafeStatement = strippedQuote || contaminated;
  const summary =
    low || (unsafeStatement && !fileSupported)
      ? PROJECT_FILE_RECEIVED
      : semanticSummary(record.semanticClass);
  const render = low
    ? files.length > 0
    : fileSupported
      ? true
      : unsafeStatement
        ? files.length > 0
        : true;
  return {
    render,
    own,
    files,
    summary,
    excerpt: null,
    subject: normalizedSubject(record.subject),
  };
}
