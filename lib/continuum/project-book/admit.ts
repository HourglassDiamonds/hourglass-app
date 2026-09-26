/**
 * Project Book evidence admission.
 * Trusted chronology requires a trusted association and display text that
 * does not leak quoted mail, parser fields, or internal ids.
 * Semantic summaries do not require an excerpt.
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
  /^(?:image\d+|logo\d*|spacer\d*|pixel\d*|tracking\d*|signature\d*|banner\d*|icon\d*|untitled|unnamed|noname)(?:[-_.]\d+)?\.(?:jpe?g|png|gif|webp)$/i;
const INLINE_IMAGE = /^image\d+\.(?:jpe?g|png|gif|webp)$/i;

const DISTRUST =
  /do not guess|don't guess|do-not-guess|ambiguous identity|multiple [^.\n]{0,80}clients|conflicting project/i;

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
  const hay = [input.matchJudgmentRaw ?? "", ...(input.noteTexts ?? [])].join("\n");
  if (DISTRUST.test(hay)) return "needs_review";
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

export function semanticSummary(
  semanticClass: SourceCommunicationEventClass | null,
  filenames: readonly string[],
  cadIds: readonly string[],
): string {
  const labels = attachmentLabels(filenames);
  const cad = cadIds.map((id) => id.trim().toUpperCase()).find((id) => /^C\d{5,}$/.test(id));
  switch (semanticClass) {
    case "client_requests":
      return "Client requested an update";
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
      if (labels.includes("CAD") && labels.includes("STL")) return "CAD and STL received.";
      if (labels.includes("CAD") && cad) return `CAD ${cad} received.`;
      if (labels.includes("STL")) return "STL received.";
      if (labels.includes("CAD")) return "Shop delivered CAD.";
      return "Shop delivered an artifact";
    case "vendor_order_confirmation":
      return "Shop confirmed the order";
    case "workshop_started":
      return "Workshop production started";
    case "client_replies_nonblocking":
      return "Client reply";
    case "vendor_acknowledges":
      return "Shop acknowledgement";
    default:
      return "Source note";
  }
}

function structuralWithoutBody(record: ProjectBookSourceRecord, files: readonly string[]): boolean {
  const labels = attachmentLabels(files);
  const hay = `${record.subject ?? ""}\n${files.join("\n")}`;
  if (record.semanticClass === "vendor_delivers_artifact") return labels.length > 0;
  if (record.semanticClass === "vendor_order_confirmation") {
    return /\bSP\d{4,}\b|order confirmation/i.test(hay);
  }
  if (record.semanticClass === "workshop_started") return /\bRN\d{4,}\b|\bworkshop\b/i.test(hay);
  return false;
}

export type AdmittedProjectEvidence = {
  render: boolean;
  own: string;
  files: readonly string[];
  summary: string;
  excerpt: string | null;
  subject: string | null;
};

/**
 * Trusted display admission for one already-associated record.
 * Contaminated fulfillment text is omitted. A shop delivery can still
 * render from filename metadata alone.
 */
export function admitProjectEvidence(record: ProjectBookSourceRecord): AdmittedProjectEvidence {
  const files = meaningfulAttachmentNames(record.attachmentFilenames);
  const own = folded(authorOwnedText(record.authorOwnedText));
  const summary = semanticSummary(record.semanticClass, files, record.cadIds);
  const ownUnsafe = !own || founderCopyUnsafe(own);
  const structural = structuralWithoutBody(record, files);
  const render =
    record.semanticClass === "founder_fulfills_commitment"
      ? Boolean(own) && !founderCopyUnsafe(own)
      : !ownUnsafe || structural;
  const excerpt =
    render && !ownUnsafe && own.length >= 12 && !/^(?:thanks|thank you|got it|perfect|sounds good)[!.\s]*$/i.test(own)
      ? safeFounderCopy(own)
      : null;
  return {
    render,
    own,
    files,
    summary,
    excerpt: record.semanticClass && summary !== "Source note" && summary !== "Client reply" && summary !== "Shop acknowledgement"
      ? null
      : excerpt,
    subject: safeFounderCopy(record.subject),
  };
}
