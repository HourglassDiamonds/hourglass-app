/**
 * Coarse current-work class from a source message.
 * Operates on author-owned current text, subject, actor, and this-message files.
 * Quoted historical text is ignored. Read-model only.
 */

import { authorOwnedText, quotedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import type {
  SourceCommunicationActor,
  SourceCommunicationEventClass,
} from "./types";

const CAD_FILE = /NL-H017-.+-C\d{5,}/i;
const STL_FILE = /\.stl\b|\bstl\b/i;
const MOD_TOKEN = /\bmod\s*\d+\b|-Mod\s*\d+/i;
const WORKSHOP_STARTED =
  /\b(?:stone|piece|job|order)\b[^.!?\n]{0,80}\b(?:sent|received|going|headed)\b[^.!?\n]{0,50}\b(?:to|at|by)?\s*(?:the )?workshop\b|\b(?:workshop (?:received|started)|production (?:has )?started|started production|on the bench)\b/i;
const ARTIFACT_DELIVERED =
  /\b(?:here is|attached|delivered|sent)\b[^.!?\n]{0,80}\b(?:mod\s*\d+\s+)?(?:stl|cad)\b|\b(?:mod\s*\d+\s+)?(?:stl|cad)\b[^.!?\n]{0,40}\b(?:attached|delivered|sent)\b/i;
const CAD_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|I(?:'ll| will) send (?:you )?(?:the )?(?:updated |final )?(?:CAD|STL|file)|final CAD(?:\s+(?:in|is expected|expected|within))?|CAD in (?:about |approximately )?\d+|I should have (?:it|them)|deliver(?:y)? by (?:\d{1,2}[/-]\d{1,2}|20\d{2}-\d{2}-\d{2})|waiting on .{0,50}(?:delivery|stone|pearl)|[~≈]?\s*\d+\s*(?:\+\/-|±)?\s*business days?)\b/i;
const VENDOR_ACK =
  /^(?:thank you(?: so much)?!?|thanks!?|got it!?|perfect!?|sounds good!?)[\s.]*$/i;
const CLIENT_APPROVES =
  /\b(?:love(?:s|d)? (?:it|the|option)|looks (?:great|perfect|amazing)|approved|let(?:'s| us) move forward|move(?:ing)? forward)\b/i;
const REQUEST =
  /\b(?:can you|could you|please)\s+(?:send|make|revise|update|price|quote|confirm|change)\b|\bneed you to\b|\?/i;
const SHIPPING =
  /\b(?:shipping address|new address|updated address|please (?:use|ship to) (?:this |the )?(?:updated )?address)\b/i;
const SERVICE_REQUEST = /\b(?:resize|repair|service|rework)\b/i;
const FOUNDER_VENDOR_INSTRUCTION =
  /\b(?:(?<!before )moving forward|please proceed|please send (?:the )?(?:stl|cad)|latest version looks like winner|use this (?:for|on) (?:the )?(?:cad|update)|headed to the shop)\b/i;
const FOUNDER_PRINT_PLAN =
  /\bI(?:'ll| will| am going to| planned to)?\s*(?:print|check|show|look at)[^.!?\n]{0,180}|\b(?:print(?:ing)?|check(?:ing)?)\s+(?:the\s+)?(?:updated\s+)?(?:model|stl|earring|huggie|size|proportion)/i;
const FOUNDER_CLIENT_UPDATE =
  /\blet me know what you think\b|\bhere(?:'s| is) the (?:latest |updated )?(?:cad|stl|render|design)\b|\bthoughts\??\b/i;
const FOUNDER_FULFILL =
  /\bheaded to you\b|\b(?:i(?:'m| am) )?(?:mail(?:ing)?|ship(?:ping)?)\b|\bi(?:'ll| will) (?:send|get|show|check|look(?:\s+into)?|follow up|call|email)\b/i;
const HGD_VENDOR_THREAD = /\bHGD\s*x\s+.+-C\d{5,}/i;
const DISCREPANCY = /\b(?:discrepanc|report .{0,40}asap|please (?:review|check|confirm|report))\b/i;

const DIRECT_NEGATION =
  /\b(?:not|never|isn['’]?t|wasn['’]?t|aren['’]?t|weren['’]?t|hasn['’]?t|haven['’]?t|no longer)\b/i;
const COMPLETE_STATUS =
  /\b(?:order|ring|piece|job|work)\b.{0,35}\b(?:is |was |has been )?(?:delivered|completed|complete)\b/i;
const READY_STATUS = /\b(?:ready for (?:pickup|collection|delivery)|ready to ship)\b/i;

function operationalClauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+|\s+\bbut\b\s+/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function hasAffirmativeStatus(text: string, phrase: RegExp): boolean {
  return operationalClauses(text).some(
    (clause) => phrase.test(clause) && !DIRECT_NEGATION.test(clause),
  );
}

export type ClassifySourceCommunicationInput = {
  actor: SourceCommunicationActor;
  direction: "inbound" | "outbound" | "unknown";
  subject: string | null;
  authorOwnedText: string;
  quotedText?: string;
  attachmentFilenames?: readonly string[];
  hasAttachments?: boolean;
};

function folded(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function fileHay(names: readonly string[] | undefined): string {
  return (names ?? []).join("\n");
}

function ownHay(input: ClassifySourceCommunicationInput): string {
  const own = authorOwnedText(input.authorOwnedText) || input.authorOwnedText;
  const quoted = quotedText(input.quotedText || input.authorOwnedText);
  const ownFolded = folded(own);
  if (quoted && ownFolded && folded(quoted) === ownFolded) return "";
  return [ownFolded, fileHay(input.attachmentFilenames)]
    .filter(Boolean)
    .join("\n");
}

function hasCadArtifact(input: ClassifySourceCommunicationInput, hay: string): boolean {
  const files = fileHay(input.attachmentFilenames);
  if (CAD_FILE.test(files) || MOD_TOKEN.test(files) || STL_FILE.test(files)) return true;
  return ARTIFACT_DELIVERED.test(hay);
}

function vendorShopThread(subject: string | null): boolean {
  return HGD_VENDOR_THREAD.test(subject ?? "");
}

export function classifySourceCommunication(
  input: ClassifySourceCommunicationInput,
): SourceCommunicationEventClass {
  const hay = ownHay(input);
  const files = fileHay(input.attachmentFilenames);
  const actor = input.actor;
  const outbound = input.direction === "outbound" || actor === "founder";

  if (["vendor_shop", "founder", "client"].includes(actor)) {
    if (hasAffirmativeStatus(hay, COMPLETE_STATUS) && !/\b(?:will|when|once|if)\b/i.test(hay)) return "work_complete";
    if (hasAffirmativeStatus(hay, READY_STATUS) && !/\b(?:will|when|once|if)\b/i.test(hay)) return "work_ready";
  }
  if (actor === "vendor_shop" || (actor === "unknown" && vendorShopThread(input.subject) && !outbound)) {
    const ownOnly = folded(authorOwnedText(input.authorOwnedText) || input.authorOwnedText);
    if (ownOnly && VENDOR_ACK.test(ownOnly) && !REQUEST.test(ownOnly)) {
      return "vendor_acknowledges";
    }
    if (!ownOnly && !files && !input.hasAttachments) return "vendor_acknowledges";
    if (hasCadArtifact(input, hay)) return "vendor_delivers_artifact";
    if (
      /\bi(?:'ll| will)\b.{0,80}\border confirmation\b/i.test(hay) &&
      !/\bSP\d{4,}\b/i.test(hay) &&
      !DISCREPANCY.test(hay)
    ) {
      return "vendor_promises";
    }
    if (/\border confirmation\b/i.test(hay) && (/\bSP\d{4,}\b/i.test(hay) || DISCREPANCY.test(hay))) {
      return "vendor_order_confirmation";
    }
    if ((WORKSHOP_STARTED.test(hay) || /\b(?:is|are|now) in (?:production|manufacturing)\b/i.test(hay)) && !/\b(?:not|will|once|if)\b[^.!?]{0,50}\b(?:production|manufacturing)\b/i.test(hay)) {
      return "workshop_started";
    }
    if (CAD_FORTHCOMING.test(hay) && !ARTIFACT_DELIVERED.test(hay)) return "vendor_promises";
    if (SHIPPING.test(hay)) return "unknown_communication";
    if (!hasCadArtifact(input, hay) && !REQUEST.test(hay) && !DISCREPANCY.test(hay) && !SHIPPING.test(hay)) {
      return "vendor_acknowledges";
    }
    return "unknown_communication";
  }

  if (actor === "client") {
    if (CLIENT_APPROVES.test(hay)) return "client_approves";
    if (SHIPPING.test(hay) || SERVICE_REQUEST.test(hay) || REQUEST.test(hay)) return "client_requests";
    return "client_replies_nonblocking";
  }

  if (actor === "founder" || outbound) {
    if (FOUNDER_FULFILL.test(hay)) return "founder_fulfills_commitment";
    if (FOUNDER_PRINT_PLAN.test(hay) && !REQUEST.test(hay) && !vendorShopThread(input.subject)) {
      return "unknown_communication";
    }
    if (FOUNDER_CLIENT_UPDATE.test(hay) && !FOUNDER_VENDOR_INSTRUCTION.test(hay)) {
      return "founder_updates_client";
    }
    if (FOUNDER_VENDOR_INSTRUCTION.test(hay) || SERVICE_REQUEST.test(hay) || REQUEST.test(hay)) {
      return "founder_requests_vendor";
    }
    if (vendorShopThread(input.subject) && (input.hasAttachments === true || files.length > 0)) {
      return "founder_requests_vendor";
    }
    if (input.hasAttachments && !REQUEST.test(hay) && !vendorShopThread(input.subject)) {
      return "founder_fulfills_commitment";
    }
    return "unknown_communication";
  }

  if (actor === "system") return "unknown_communication";
  return "unknown_communication";
}

export type ClassifiedSourceCommunication = {
  semanticClass: SourceCommunicationEventClass;
  evidenceExcerpt: string;
};

/** A single message may contain multiple concrete operational transitions. */
export function classifySourceCommunications(
  input: ClassifySourceCommunicationInput,
): ClassifiedSourceCommunication[] {
  const own = authorOwnedText(input.authorOwnedText) || input.authorOwnedText;
  const clauses = operationalClauses(own);
  const grouped = new Map<SourceCommunicationEventClass, string[]>();
  for (const clause of clauses) {
    const semanticClass = classifySourceCommunication({
      ...input,
      authorOwnedText: clause,
      quotedText: "",
      attachmentFilenames: [],
      hasAttachments: false,
    });
    if (
      semanticClass === "unknown_communication" ||
      semanticClass === "vendor_acknowledges" ||
      semanticClass === "client_replies_nonblocking"
    )
      continue;
    const list = grouped.get(semanticClass) ?? [];
    list.push(clause);
    grouped.set(semanticClass, list);
  }
  if (input.hasAttachments || input.attachmentFilenames?.length) {
    const semanticClass = classifySourceCommunication({
      ...input,
      authorOwnedText: "",
      quotedText: "",
    });
    if (semanticClass === "vendor_delivers_artifact") {
      const list = grouped.get(semanticClass) ?? [];
      list.push(...(input.attachmentFilenames ?? []));
      grouped.set(semanticClass, list);
    }
  }
  if (grouped.size === 0) {
    return [
      {
        semanticClass: classifySourceCommunication(input),
        evidenceExcerpt: own.trim(),
      },
    ];
  }
  const boundedMessageEvidence = own.trim();
  return [...grouped].map(([semanticClass, excerpts]) => ({
    semanticClass,
    evidenceExcerpt:
      boundedMessageEvidence || [...new Set(excerpts)].join(" ").trim(),
  }));
}
